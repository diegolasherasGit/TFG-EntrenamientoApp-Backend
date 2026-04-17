import express from 'express';
import {
    register,
    login,
    getProfile,
    updateUser,
    deleteUser,
    googleLogin,
    restoreUser,
    createPrivilegedUser,
    uploadPhoto,
    removePhoto
} from '../controllers/userController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google-login', googleLogin);

router.get('/profile/:id', protect, getProfile);
router.put('/profile/:id', protect, updateUser);
router.delete('/profile/:id', protect, deleteUser);

router.patch('/profile/:id/restore', protect, restrictTo('admin'), restoreUser);
router.post('/privileged', protect, restrictTo('admin'), createPrivilegedUser);

router.post('/profile/:id/photo', protect, uploadPhoto);
router.delete('/profile/:id/photo', protect, removePhoto);

export default router;
