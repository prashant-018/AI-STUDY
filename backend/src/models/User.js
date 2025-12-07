import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: {
      type: String,
      required: function () {
        return this.authProvider === 'local';
      },
      minlength: 6
    },
    googleId: { type: String, unique: true, sparse: true },
    profilePicture: { type: String },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    isVerified: { type: Boolean, default: false },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const User = mongoose.models.User || mongoose.model('User', UserSchema);
export default User;



