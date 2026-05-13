import {request, response} from 'express';
import prisma from '../model/index.js'
import bycrypt from 'bycrypt';
import jwt from 'jsonwebtoken';

export const registerUser = async (
    req : request,
    res : respond,
)=>
{ =>
    try
    {
        const { name, email, password } = req.body;
    }
}
