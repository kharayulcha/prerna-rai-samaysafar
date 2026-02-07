import express from 'express';
import { createBus, deleteBus, editBus, getBus, listBuses } from '../controller/busController.js';
import catchAsync from '../utils/catchAsync.js';
const router = express.Router();
// List and create
router.get('/get-buses', catchAsync(listBuses)); // GET /api/buses
router.post('/add-bus', catchAsync(createBus)); // POST /api/buses (admin)
// Single bus operations
router.get('/:id', catchAsync(getBus)); // GET /api/buses/:id
router.put('/:id', catchAsync(editBus)); // PUT /api/buses/:id (admin)
router.delete('/:id', catchAsync(deleteBus)); // DELETE /api/buses/:id (admin)
export default router;
//# sourceMappingURL=busRoutes.js.map