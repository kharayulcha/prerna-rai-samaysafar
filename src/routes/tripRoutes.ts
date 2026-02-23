import express from 'express';
import { endTrip, getActiveTrip, getMyActiveTrip, getTripLocations, saveLocation, startTrip } from '../controller/tripController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.post('/start', catchAsync(startTrip));
router.post('/end', catchAsync(endTrip));
router.post('/location', catchAsync(saveLocation));
router.get('/my-active', catchAsync(getMyActiveTrip));
router.get('/active/:routeId', catchAsync(getActiveTrip));
router.get('/locations/:tripId', catchAsync(getTripLocations));

export default router;
