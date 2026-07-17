import mongoose from 'mongoose'

const topicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Topic folder name is required'],
    trim: true,
    maxlength: [200, 'Topic name cannot exceed 200 characters']
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
})

// Index for sorting within a session
topicSchema.index({ session: 1, order: 1 })

const Topic = mongoose.model('Topic', topicSchema)

export default Topic
