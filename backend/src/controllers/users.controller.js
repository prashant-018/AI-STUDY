import User from '../models/User.js';

export const listUsers = async (_req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Failed to fetch users' });
  }
};

export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Failed to fetch user' });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { name } = req.body || {};
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { ...(name ? { name } : {}) },
      { new: true, runValidators: true }
    ).select('-password');
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Failed to update user' });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Failed to delete user' });
  }
};



