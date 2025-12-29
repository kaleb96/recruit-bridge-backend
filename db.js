import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/recruit_bridge');
    console.log('MongoDB Connected...');
  } catch (error) {
    console.log('Failed to connect DB', error);
    process.exit(1);
  }
};
