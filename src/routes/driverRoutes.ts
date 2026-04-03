import express from 'express';
import { createDriver, deleteDriver, editDriver, getDriver, listDrivers, getDriverAssignment } from '../controller/driverController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

// List drivers
router.get('/get-drivers', catchAsync(listDrivers)); // GET /api/drivers

// Single driver operations
router.post('/create', catchAsync(createDriver)); // POST /api/drivers/create (admin)
router.get('/:id', catchAsync(getDriver)); // GET /api/drivers/:id
router.get('/:id/assignment', catchAsync(getDriverAssignment)); // GET /api/drivers/:id/assignment
router.put('/:id', catchAsync(editDriver)); // PUT /api/drivers/:id (admin)
router.delete('/:id', catchAsync(deleteDriver)); // DELETE /api/drivers/:id (admin)

export default router;
