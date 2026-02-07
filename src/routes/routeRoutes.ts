import express from 'express';
import { createRoute, deleteRoute, editRoute, getRoute, listRoutes, getStudentSchedule } from '../controller/routeController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

// List routes (scoped to organization)
router.get('/get-routes', catchAsync(listRoutes)); // US-10

// Get a single route
router.get('/:id', catchAsync(getRoute)); // US-11

// Get student personalized schedule
router.get('/student-schedule/view', catchAsync(getStudentSchedule));

// Create a new route (admin users only)
router.post('/create-route', catchAsync(createRoute)); // US-7

// Edit a route
router.put('/:id', catchAsync(editRoute)); // US-8

// Delete a route
router.delete('/:id', catchAsync(deleteRoute)); // US-9

export default router;
