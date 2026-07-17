import mongoose from 'mongoose'

const completionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  resource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource',
    required: true
  },
  status: {
    type: String,
    enum: ['completed'],
    default: 'completed'
  },
  completedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

// Composite unique index so a user can complete a resource only once
completionSchema.index({ user: 1, resource: 1 }, { unique: true })

const Completion = mongoose.model('Completion', completionSchema)

export default Completion
