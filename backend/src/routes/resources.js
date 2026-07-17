import express from 'express'
import multer from 'multer'
import { authenticate, authorize } from '../middleware/auth.js'
import { uploadToStorage, deleteFromStorage } from '../services/storageService.js'
import Session from '../models/Session.js'
import Topic from '../models/Topic.js'
import Resource from '../models/Resource.js'
import Bookmark from '../models/Bookmark.js'
import Completion from '../models/Completion.js'
import TopicStats from '../models/TopicStats.js'

const router = express.Router()

// Multer in-memory configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB file size limit
})

// Escape regex helper
function escapeRegex(string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
}

// ==========================================
// SESSION (Folder) Routes
// ==========================================

// Create new session folder
router.post('/sessions', authenticate, authorize('teacher'), async (req, res) => {
  try {
    const { name } = req.body
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Session folder name is required' })
    }

    // Auto-calculate order index
    const maxSession = await Session.findOne({ teacher: req.user._id }).sort({ order: -1 })
    const nextOrder = maxSession ? maxSession.order + 1 : 0

    const session = new Session({
      name: name.trim(),
      teacher: req.user._id,
      order: nextOrder
    })

    await session.save()
    res.status(201).json({ success: true, session })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get hierarchical folder tree (Sessions -> Topics -> Resources)
router.get('/sessions', authenticate, async (req, res) => {
  try {
    let query = {}
    
    // Teachers only see their own library, students see all libraries 
    // or we can allow filtering. If we filter by teacher query param, that's great
    if (req.user.role === 'teacher') {
      query.teacher = req.user._id
    } else if (req.query.teacherId) {
      query.teacher = req.query.teacherId
    }

    const sessions = await Session.find(query).sort({ order: 1 }).lean()
    
    const sessionIds = sessions.map(s => s._id)
    const topics = await Topic.find({ session: { $in: sessionIds } }).sort({ order: 1 }).lean()
    
    const topicIds = topics.map(t => t._id)
    const resources = await Resource.find({ topic: { $in: topicIds } }).sort({ order: 1 }).lean()

    // Nest items
    const hierarchy = sessions.map(session => {
      const sessionTopics = topics
        .filter(t => t.session.toString() === session._id.toString())
        .map(topic => {
          const topicResources = resources.filter(r => r.topic.toString() === topic._id.toString())
          return { ...topic, resources: topicResources }
        })
      return { ...session, topics: sessionTopics }
    })

    res.json({ success: true, hierarchy })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update session folder
router.put('/sessions/:id', authenticate, authorize('teacher'), async (req, res) => {
  try {
    const { name } = req.body
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Session folder name is required' })
    }

    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, teacher: req.user._id },
      { name: name.trim() },
      { new: true }
    )

    if (!session) {
      return res.status(404).json({ error: 'Session folder not found or unauthorized' })
    }

    res.json({ success: true, session })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete session folder (cascades topics and resources)
router.delete('/sessions/:id', authenticate, authorize('teacher'), async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, teacher: req.user._id })
    if (!session) {
      return res.status(404).json({ error: 'Session folder not found or unauthorized' })
    }

    const topics = await Topic.find({ session: session._id })
    const topicIds = topics.map(t => t._id)

    // Find and delete files from storage
    const resources = await Resource.find({ topic: { $in: topicIds } })
    for (const resItem of resources) {
      if (resItem.fileKey) {
        await deleteFromStorage(resItem.fileKey)
      }
    }

    // Cascade delete DB entries
    await Resource.deleteMany({ topic: { $in: topicIds } })
    await Topic.deleteMany({ session: session._id })
    await session.deleteOne()

    res.json({ success: true, message: 'Session folder and all contents deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})


// ==========================================
// TOPIC (Sub-folder) Routes
// ==========================================

// Create new topic sub-folder
router.post('/topics', authenticate, authorize('teacher'), async (req, res) => {
  try {
    const { name, sessionId } = req.body
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Topic folder name is required' })
    }
    if (!sessionId) {
      return res.status(400).json({ error: 'Parent Session ID is required' })
    }

    // Verify session folder ownership
    const session = await Session.findOne({ _id: sessionId, teacher: req.user._id })
    if (!session) {
      return res.status(404).json({ error: 'Parent Session folder not found or unauthorized' })
    }

    // Auto-calculate order index
    const maxTopic = await Topic.findOne({ session: sessionId }).sort({ order: -1 })
    const nextOrder = maxTopic ? maxTopic.order + 1 : 0

    const topic = new Topic({
      name: name.trim(),
      session: sessionId,
      order: nextOrder
    })

    await topic.save()
    res.status(201).json({ success: true, topic })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update topic folder
router.put('/topics/:id', authenticate, authorize('teacher'), async (req, res) => {
  try {
    const { name } = req.body
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Topic name is required' })
    }

    // Topic belongs to a session, verify ownership of parent session
    const topic = await Topic.findById(req.params.id)
    if (!topic) {
      return res.status(404).json({ error: 'Topic folder not found' })
    }

    const session = await Session.findOne({ _id: topic.session, teacher: req.user._id })
    if (!session) {
      return res.status(403).json({ error: 'Unauthorized topic update' })
    }

    topic.name = name.trim()
    await topic.save()

    res.json({ success: true, topic })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete topic folder (cascades resources)
router.delete('/topics/:id', authenticate, authorize('teacher'), async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id)
    if (!topic) {
      return res.status(404).json({ error: 'Topic folder not found' })
    }

    const session = await Session.findOne({ _id: topic.session, teacher: req.user._id })
    if (!session) {
      return res.status(403).json({ error: 'Unauthorized topic deletion' })
    }

    // Delete files in storage
    const resources = await Resource.find({ topic: topic._id })
    for (const resItem of resources) {
      if (resItem.fileKey) {
        await deleteFromStorage(resItem.fileKey)
      }
    }

    // Cascade delete
    await Resource.deleteMany({ topic: topic._id })
    await topic.deleteOne()

    res.json({ success: true, message: 'Topic folder and all resources deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})


// ==========================================
// RESOURCE (Learning Asset) Routes
// ==========================================

// Create resource item
router.post('/', authenticate, authorize('teacher'), async (req, res) => {
  try {
    const { title, topicId, type, url, fileKey, tags } = req.body

    if (!title || !topicId || !type || !url) {
      return res.status(400).json({ error: 'Title, Topic ID, Resource Type, and URL are required' })
    }

    // Verify topic folder owner
    const topic = await Topic.findById(topicId)
    if (!topic) {
      return res.status(404).json({ error: 'Topic subfolder not found' })
    }

    const session = await Session.findOne({ _id: topic.session, teacher: req.user._id })
    if (!session) {
      return res.status(403).json({ error: 'Unauthorized to add resources here' })
    }

    // Auto-calculate order index
    const maxResource = await Resource.findOne({ topic: topicId }).sort({ order: -1 })
    const nextOrder = maxResource ? maxResource.order + 1 : 0

    const resource = new Resource({
      title: title.trim(),
      topic: topicId,
      type,
      url: url.trim(),
      fileKey: fileKey || '',
      tags: Array.isArray(tags) ? tags.map(t => t.trim()) : [],
      order: nextOrder,
      teacher: req.user._id
    })

    await resource.save()
    res.status(201).json({ success: true, resource })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// List resources with query filters (Topic, Type, Tags, Search query)
router.get('/', authenticate, async (req, res) => {
  try {
    const { topicId, type, tag, search, teacherId } = req.query
    let query = {}

    // Enforce teacher separation or let students filter
    if (req.user.role === 'teacher') {
      query.teacher = req.user._id
    } else if (teacherId) {
      query.teacher = teacherId
    }

    if (topicId) query.topic = topicId
    if (type) query.type = type
    if (tag) query.tags = tag

    if (search) {
      query.$or = [
        { title: { $regex: escapeRegex(search), $options: 'i' } },
        { tags: { $regex: escapeRegex(search), $options: 'i' } }
      ]
    }

    const resources = await Resource.find(query)
      .sort({ order: 1 })
      .populate('topic')
      .lean()

    res.json({ success: true, resources })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get single resource detail
router.get('/:id', authenticate, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id).populate('topic').lean()
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' })
    }
    res.json({ success: true, resource })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update resource details
router.put('/:id', authenticate, authorize('teacher'), async (req, res) => {
  try {
    const { title, type, url, fileKey, tags, topicId } = req.body
    const resource = await Resource.findOne({ _id: req.params.id, teacher: req.user._id })

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found or unauthorized' })
    }

    // If fileKey is changing/replaced, clean up the old file from storage!
    if (fileKey && resource.fileKey && fileKey !== resource.fileKey) {
      await deleteFromStorage(resource.fileKey)
    }

    if (title) resource.title = title.trim()
    if (type) resource.type = type
    if (url) resource.url = url.trim()
    if (fileKey !== undefined) resource.fileKey = fileKey
    if (tags) resource.tags = Array.isArray(tags) ? tags.map(t => t.trim()) : []
    
    if (topicId) {
      // Validate the destination topic
      const topic = await Topic.findById(topicId)
      if (!topic) {
        return res.status(400).json({ error: 'Target topic folder not found' })
      }
      resource.topic = topicId
    }

    await resource.save()
    res.json({ success: true, resource })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete resource item
router.delete('/:id', authenticate, authorize('teacher'), async (req, res) => {
  try {
    const resource = await Resource.findOne({ _id: req.params.id, teacher: req.user._id })
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found or unauthorized' })
    }

    // Clean up physical storage
    if (resource.fileKey) {
      await deleteFromStorage(resource.fileKey)
    }

    // Clean up completions and bookmarks referencing this resource
    await Bookmark.deleteMany({ resource: resource._id })
    await Completion.deleteMany({ resource: resource._id })
    
    await resource.deleteOne()
    res.json({ success: true, message: 'Resource deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Upload file to cloud / local storage
router.post('/upload', authenticate, authorize('teacher'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const result = await uploadToStorage(req.file)
    res.json({
      success: true,
      url: result.url,
      fileKey: result.fileKey,
      fileName: req.file.originalname,
      fileType: req.file.mimetype
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})


// ==========================================
// REORDER & MOVE Routes
// ==========================================

// Bulk reorder sessions, topics or resources
router.put('/reorder', authenticate, authorize('teacher'), async (req, res) => {
  try {
    const { type, orders } = req.body // orders: [{ id: "...", order: 0 }, { id: "...", order: 1 }]

    if (!type || !Array.isArray(orders)) {
      return res.status(400).json({ error: 'Invalid reorder body data' })
    }

    const updatePromises = orders.map(async (item) => {
      if (type === 'session') {
        return Session.findOneAndUpdate(
          { _id: item.id, teacher: req.user._id },
          { order: item.order }
        )
      } else if (type === 'topic') {
        // Must belong to teacher's session folder, verify implicitly or update directly
        const topic = await Topic.findById(item.id)
        if (topic) {
          const session = await Session.findOne({ _id: topic.session, teacher: req.user._id })
          if (session) {
            topic.order = item.order
            return topic.save()
          }
        }
      } else if (type === 'resource') {
        return Resource.findOneAndUpdate(
          { _id: item.id, teacher: req.user._id },
          { order: item.order }
        )
      }
    })

    await Promise.all(updatePromises)
    res.json({ success: true, message: `Reordering of ${type}s completed successfully` })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Move a resource folder/topic
router.put('/move', authenticate, authorize('teacher'), async (req, res) => {
  try {
    const { resourceId, topicId } = req.body

    if (!resourceId || !topicId) {
      return res.status(400).json({ error: 'resourceId and topicId are required' })
    }

    const resource = await Resource.findOne({ _id: resourceId, teacher: req.user._id })
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found or unauthorized' })
    }

    const topic = await Topic.findById(topicId)
    if (!topic) {
      return res.status(404).json({ error: 'Destination topic folder not found' })
    }

    // Verify teacher owns the destination topic folder session
    const session = await Session.findOne({ _id: topic.session, teacher: req.user._id })
    if (!session) {
      return res.status(403).json({ error: 'Unauthorized to move resource to this folder' })
    }

    // Find current max order in target topic to put it at the end
    const maxResource = await Resource.findOne({ topic: topicId }).sort({ order: -1 })
    const nextOrder = maxResource ? maxResource.order + 1 : 0

    resource.topic = topicId
    resource.order = nextOrder
    await resource.save()

    res.json({ success: true, message: 'Resource moved successfully', resource })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})


// ==========================================
// STUDENT ACTIONS Routes
// ==========================================

// Toggle bookmark a resource
router.post('/bookmark', authenticate, authorize('student'), async (req, res) => {
  try {
    const { resourceId } = req.body
    if (!resourceId) {
      return res.status(400).json({ error: 'resourceId is required' })
    }

    const existingBookmark = await Bookmark.findOne({ user: req.user._id, resource: resourceId })

    if (existingBookmark) {
      await existingBookmark.deleteOne()
      return res.json({ success: true, bookmarked: false, message: 'Bookmark removed' })
    } else {
      const bookmark = new Bookmark({
        user: req.user._id,
        resource: resourceId
      })
      await bookmark.save()
      return res.status(201).json({ success: true, bookmarked: true, message: 'Bookmark added' })
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get all bookmarks for the student
router.get('/bookmarks', authenticate, authorize('student'), async (req, res) => {
  try {
    const bookmarks = await Bookmark.find({ user: req.user._id })
      .populate({
        path: 'resource',
        populate: {
          path: 'topic',
          populate: { path: 'session' }
        }
      })
      .lean()

    // Filter out bookmarks referencing deleted resources
    const validBookmarks = bookmarks.filter(b => b.resource)
    res.json({ success: true, bookmarks: validBookmarks.map(b => b.resource) })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Toggle complete status on a resource
router.post('/complete', authenticate, authorize('student'), async (req, res) => {
  try {
    const { resourceId } = req.body
    if (!resourceId) {
      return res.status(400).json({ error: 'resourceId is required' })
    }

    const existingCompletion = await Completion.findOne({ user: req.user._id, resource: resourceId })

    if (existingCompletion) {
      await existingCompletion.deleteOne()
      return res.json({ success: true, completed: false, message: 'Completion status removed' })
    } else {
      const completion = new Completion({
        user: req.user._id,
        resource: resourceId
      })
      await completion.save()
      return res.status(201).json({ success: true, completed: true, message: 'Resource marked as completed' })
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get all completions for the student
router.get('/completions', authenticate, authorize('student'), async (req, res) => {
  try {
    const completions = await Completion.find({ user: req.user._id }).lean()
    res.json({ success: true, completions: completions.map(c => c.resource.toString()) })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get personalized recommendations based on weak areas
router.get('/recommendations', authenticate, authorize('student'), async (req, res) => {
  try {
    const studentId = req.user._id
    
    // 1. Fetch student's weak topics (accuracy < 60%) from live quiz data
    const weakStats = await TopicStats.find({
      studentId,
      accuracyPercentage: { $lt: 60 }
    }).lean()

    if (weakStats.length === 0) {
      return res.json({ success: true, recommendations: [] })
    }

    const weakTopicLabels = weakStats.map(s => s.topicLabel)

    // Filter out casual/general lecture topics
    const casualTopicKeywords = ['general lecture', 'general', 'casual', 'unassigned', 'random', 'default', 'casual lecture']
    const filteredWeakTopics = weakTopicLabels.filter(topic => {
      if (!topic) return false
      const lowerTopic = topic.toLowerCase().trim()
      return !casualTopicKeywords.some(keyword => lowerTopic.includes(keyword))
    })

    if (filteredWeakTopics.length === 0) {
      return res.json({ success: true, recommendations: [] })
    }

    // Escape regex strings to prevent malicious entries or syntax breakages
    const escapedLabels = filteredWeakTopics.map(label => escapeRegex(label))
    const regexQuery = escapedLabels.map(label => new RegExp(label, 'i'))

    // 2. Find folders (Topics) whose name matches these weak labels
    const matchingTopics = await Topic.find({
      name: { $in: regexQuery }
    }).lean()
    
    const topicIds = matchingTopics.map(t => t._id)

    // 3. Find resources that fall under these topics OR are tagged with the weak topic name
    const recommendations = await Resource.find({
      $or: [
        { topic: { $in: topicIds } },
        { tags: { $in: regexQuery } }
      ]
    })
    .populate({
      path: 'topic',
      populate: { path: 'session' }
    })
    .limit(8)
    .lean()

    res.json({ success: true, recommendations })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
