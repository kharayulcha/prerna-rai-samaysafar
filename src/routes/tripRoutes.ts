import express from 'express';
import { endTrip, startTrip } from '../controller/tripController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.post('/start', catchAsync(startTrip));
router.post('/end', catchAsync(endTrip));

export default router;
