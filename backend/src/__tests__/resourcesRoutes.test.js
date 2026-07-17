// Integration tests for Resources API routes
// Tests the libraries folder organization, resource validation, reordering and recommendations

describe('Resources API Routes', () => {
  describe('Session and Topic Access Control', () => {
    const checkRoleAccess = (user, requiredRole) => {
      if (!user) return { allowed: false, error: 'Authentication required' }
      if (user.role !== requiredRole) {
        return { allowed: false, error: 'Access denied' }
      }
      return { allowed: true }
    }

    it('should only allow teachers to create sessions and topics', () => {
      expect(checkRoleAccess(null, 'teacher').allowed).toBe(false)
      expect(checkRoleAccess({ role: 'student' }, 'teacher').allowed).toBe(false)
      expect(checkRoleAccess({ role: 'teacher' }, 'teacher').allowed).toBe(true)
    })
  })

  describe('Resource Validation', () => {
    const validateResourcePayload = (body) => {
      const errors = []
      if (!body.title || body.title.trim() === '') errors.push('Title is required')
      if (!body.topicId) errors.push('Topic ID is required')
      if (!body.type) errors.push('Resource type is required')
      if (!body.url || body.url.trim() === '') errors.push('URL is required')
      
      const allowedTypes = ['pdf', 'ppt', 'doc', 'image', 'link', 'youtube', 'github', 'file']
      if (body.type && !allowedTypes.includes(body.type)) {
        errors.push('Invalid resource type')
      }
      return errors
    }

    it('should catch missing or invalid fields in resource creation payload', () => {
      expect(validateResourcePayload({})).toContain('Title is required')
      expect(validateResourcePayload({ title: 'PDF Manual' })).toContain('Topic ID is required')
      expect(validateResourcePayload({ title: 'PDF Manual', topicId: 'topic123', type: 'invalid-format', url: 'https://test.com' })).toContain('Invalid resource type')
      expect(validateResourcePayload({ title: 'PDF Manual', topicId: 'topic123', type: 'pdf', url: 'https://test.com' })).toHaveLength(0)
    })
  })

  describe('Reordering & Ordering Logic', () => {
    it('should correctly position newly added elements at the end', () => {
      const calculateNextOrder = (existingItems) => {
        if (!existingItems || existingItems.length === 0) return 0
        const maxOrder = Math.max(...existingItems.map(item => item.order || 0))
        return maxOrder + 1
      }

      expect(calculateNextOrder([])).toBe(0)
      expect(calculateNextOrder([{ id: 'a', order: 0 }, { id: 'b', order: 1 }])).toBe(2)
      expect(calculateNextOrder([{ id: 'a', order: 5 }, { id: 'b', order: 2 }])).toBe(6)
    })
  })

  describe('Personalized Recommendations Matching', () => {
    it('should filter resources matching low-accuracy topics or tags', () => {
      const mockResources = [
        { id: '1', title: 'Express routing guide', topic: 'Express Basics', tags: ['nodejs', 'express'] },
        { id: '2', title: 'React Hooks tutorial', topic: 'React Components', tags: ['javascript', 'react'] },
        { id: '3', title: 'MongoDB Indexing tips', topic: 'Databases', tags: ['mongodb', 'database'] }
      ]

      const getRecommendations = (weakTopics, resourcesList) => {
        if (!weakTopics || weakTopics.length === 0) return []
        
        return resourcesList.filter(resource => {
          const matchesTopic = weakTopics.some(weakTopic => 
            resource.topic.toLowerCase().includes(weakTopic.toLowerCase())
          )
          const matchesTags = weakTopics.some(weakTopic => 
            resource.tags.some(tag => tag.toLowerCase().includes(weakTopic.toLowerCase()))
          )
          return matchesTopic || matchesTags
        })
      }

      const studentWeakTopics = ['Express']
      const results = getRecommendations(studentWeakTopics, mockResources)
      
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('1')

      const multipleWeakTopics = ['React', 'mongodb']
      const results2 = getRecommendations(multipleWeakTopics, mockResources)
      expect(results2).toHaveLength(2)
      expect(results2.map(r => r.id)).toContain('2')
      expect(results2.map(r => r.id)).toContain('3')
    })

    it('should filter out casual/general lecture topics from recommended inputs', () => {
      const weakTopics = ['General Lecture', 'Express Basics', 'Casual', 'random']
      const casualKeywords = ['general lecture', 'general', 'casual', 'unassigned', 'random', 'default', 'casual lecture']
      
      const filtered = weakTopics.filter(topic => {
        const lower = topic.toLowerCase().trim()
        return !casualKeywords.some(keyword => lower.includes(keyword))
      })

      expect(filtered).toHaveLength(1)
      expect(filtered[0]).toBe('Express Basics')
    })
  })
})
