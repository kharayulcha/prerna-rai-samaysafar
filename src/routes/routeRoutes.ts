import express from 'express';
import { 
  createRoute, 
  deleteRoute, 
  editRoute, 
  getRoute, 
  listRoutes, 
  getStudentSchedule,
  getRouteStops,
  addRouteStop,
  updateRouteStop,
  deleteRouteStop,
  getRouteDetails,
  searchPlaces,
  osrmRouteProxy
} from '../controller/routeController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

// Proxy for OpenStreetMap search via Node fetch
router.get('/utility/search-places', catchAsync(searchPlaces));
router.get('/utility/osrm-route', catchAsync(osrmRouteProxy));

// List routes (scoped to organization)
router.get('/get-routes', catchAsync(listRoutes)); // US-10

// Get a single route
router.get('/:id', catchAsync(getRoute)); // US-11

// Get full route details for driver
router.get('/:id/details', catchAsync(getRouteDetails));

// Get student personalized schedule
router.get('/student-schedule/view', catchAsync(getStudentSchedule));

// Create a new route (admin users only)
router.post('/create-route', catchAsync(createRoute)); // US-7

// Edit a route
router.put('/:id', catchAsync(editRoute)); // US-8

// Delete a route
router.delete('/:id', catchAsync(deleteRoute)); // US-9

// --- Landmarks / Stops ---
router.get('/:id/stops', catchAsync(getRouteStops));
router.post('/:id/stops', catchAsync(addRouteStop));
router.put('/:id/stops/:stopId', catchAsync(updateRouteStop));
router.delete('/:id/stops/:stopId', catchAsync(deleteRouteStop));

export default router;
