import express from 'express';
import {
    loginUser,
    registerUser,
} from '../controller/testController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.push
