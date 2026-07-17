import mongoose from 'mongoose'

const resourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Resource title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  topic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    required: true
  },
  type: {
    type: String,
    enum: ['pdf', 'ppt', 'doc', 'image', 'link', 'youtube', 'github', 'file'],
    required: [true, 'Resource type is required']
  },
  url: {
    type: String,
    required: [true, 'Resource URL/path is required']
  },
  fileKey: {
    type: String,
    default: ''
  },
  tags: {
    type: [String],
    default: []
  },
  order: {
    type: Number,
    default: 0
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
})

// Indexing for search, filtering, and sorting
resourceSchema.index({ topic: 1, order: 1 })
resourceSchema.index({ tags: 1 })
resourceSchema.index({ teacher: 1 })

const Resource = mongoose.model('Resource', resourceSchema)

export default Resource
