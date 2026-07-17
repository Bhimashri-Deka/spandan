import mongoose from 'mongoose'

const sessionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Session folder name is required'],
    trim: true,
    maxlength: [200, 'Session name cannot exceed 200 characters']
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
})

// Compound index for teacher and name uniqueness, and easy sorting
sessionSchema.index({ teacher: 1, order: 1 })

const Session = mongoose.model('Session', sessionSchema)

export default Session
