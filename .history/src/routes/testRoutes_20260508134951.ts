import express from 'express';
import {
    loginUser,
    registerUser,
} from '../controller/testController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.post('/register',catchAsync(registerUser));

router.post('/login',catchAsync(loginUser));

export defult router;


import express from 'express';

import {
  registerUser,
  loginUser,
} from '../controllers/auth.controller';

const router = express.Router();

router.post('/register', registerUser);

router.post('/login', loginUser);

export default router;
