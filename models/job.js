import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  recIdx: { type: String, unique: true, required: true },
  company: { type: String, index: true },
  title: String,
  location: String,
  career: String,
  date: String,
  link: String,
  category: String,
  star: { type: Number, default: null },
  updatedAt: { type: Date, default: Date.now },
});

export const Job = mongoose.model('Job', jobSchema);
