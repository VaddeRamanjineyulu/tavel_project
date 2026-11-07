require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./config/db');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'development_secret_change_me';

function auth(req,res,next){
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({message:'Please login first'});
  try { req.user=jwt.verify(token,SECRET); next(); }
  catch { return res.status(401).json({message:'Session expired. Please login again.'}); }
}
function admin(req,res,next){ if(req.user.role!=='admin') return res.status(403).json({message:'Admin access required'}); next(); }

app.get('/api/health', (req,res)=>res.json({ok:true,message:'Travel booking server is running'}));
app.get('/api/destinations', async(req,res)=>{
  try { const [rows]=await db.query('SELECT * FROM destination ORDER BY destination_id DESC'); res.json(rows); }
  catch(e){res.status(500).json({message:'Could not load destinations',error:e.message});}
});
app.get('/api/packages', async(req,res)=>{
  try { const [rows]=await db.query('SELECT * FROM packages ORDER BY packages_id DESC'); res.json(rows); }
  catch(e){res.status(500).json({message:'Could not load packages',error:e.message});}
});
app.post('/api/register', async(req,res)=>{
  try {
    const {name,email,phone,password}=req.body;
    if(!name||!email||!phone||!password) return res.status(400).json({message:'Please fill all fields'});
    if(password.length<6) return res.status(400).json({message:'Password must contain at least 6 characters'});
    const hash=await bcrypt.hash(password,10);
    const [result]=await db.query('INSERT INTO customers(name,email,phone,password) VALUES(?,?,?,?)',[name,email,phone,hash]);
    res.status(201).json({message:'Registration successful. Please login.',customer_id:result.insertId});
  } catch(e){res.status(400).json({message:e.code==='ER_DUP_ENTRY'?'Email already registered':e.message});}
});
app.post('/api/login', async(req,res)=>{
  try {
    const {email,password}=req.body;
    if(email===process.env.ADMIN_EMAIL && password===process.env.ADMIN_PASSWORD){
      const token=jwt.sign({role:'admin',email},SECRET,{expiresIn:'12h'});
      return res.json({token,role:'admin',name:'Administrator'});
    }
    const [rows]=await db.query('SELECT * FROM customers WHERE email=?',[email]);
    if(!rows.length || !(await bcrypt.compare(password,rows[0].password))) return res.status(401).json({message:'Invalid email or password'});
    const c=rows[0]; const token=jwt.sign({role:'customer',customer_id:c.customer_id,email:c.email},SECRET,{expiresIn:'12h'});
    res.json({token,role:'customer',name:c.name,customer_id:c.customer_id});
  } catch(e){res.status(500).json({message:e.message});}
});
app.post('/api/bookings',auth,async(req,res)=>{
  if(req.user.role!=='customer') return res.status(403).json({message:'Customer login required'});
  const {package_id,travel_date,person_id}=req.body;
  const people=Number(person_id);
  if(!package_id||!travel_date||!Number.isInteger(people)||people<1) return res.status(400).json({message:'Enter package, travel date and number of persons'});
  const conn=await db.getConnection();
  try {
    await conn.beginTransaction();
    const [p]=await conn.query('SELECT * FROM packages WHERE packages_id=? FOR UPDATE',[package_id]);
    if(!p.length) throw new Error('Package not found');
    if(p[0].avaiable_slots<people) throw new Error('Not enough available slots');
    const total=Number(p[0].price)*people;
    await conn.query('UPDATE packages SET avaiable_slots=avaiable_slots-? WHERE packages_id=?',[people,package_id]);
    const [b]=await conn.query('INSERT INTO bookings(customer_id,package_id,travel_date,person_id,total_amount,status) VALUES(?,?,?,?,?,?)',[req.user.customer_id,package_id,travel_date,people,total,'Pending']);
    await conn.commit(); res.status(201).json({message:'Booking submitted successfully',booking_id:b.insertId,total_amount:total});
  } catch(e){await conn.rollback();res.status(400).json({message:e.message});}
  finally{conn.release();}
});
app.get('/api/my-bookings',auth,async(req,res)=>{
  if(req.user.role!=='customer') return res.status(403).json({message:'Customer login required'});
  try {const [rows]=await db.query(`SELECT b.*,p.packages_name,p.packages_duration FROM bookings b JOIN packages p ON p.packages_id=b.package_id WHERE b.customer_id=? ORDER BY b.booking_id DESC`,[req.user.customer_id]);res.json(rows);}
  catch(e){res.status(500).json({message:e.message});}
});
app.get('/api/admin/bookings',auth,admin,async(req,res)=>{
  try {const [rows]=await db.query(`SELECT b.*,c.name,c.email,c.phone,p.packages_name FROM bookings b JOIN customers c ON c.customer_id=b.customer_id JOIN packages p ON p.packages_id=b.package_id ORDER BY b.booking_id DESC`);res.json(rows);}
  catch(e){res.status(500).json({message:e.message});}
});
app.patch('/api/admin/bookings/:id',auth,admin,async(req,res)=>{
  const {status}=req.body; if(!['Pending','Confirmed','Cancelled'].includes(status)) return res.status(400).json({message:'Invalid status'});
  try {const [r]=await db.query('UPDATE bookings SET status=? WHERE booking_id=?',[status,req.params.id]); if(!r.affectedRows)return res.status(404).json({message:'Booking not found'});res.json({message:'Booking status updated'});}
  catch(e){res.status(500).json({message:e.message});}
});
app.post('/api/admin/destinations',auth,admin,async(req,res)=>{
  const {destination_name,destination_location,destination}=req.body;
  if(!destination_name||!destination_location)return res.status(400).json({message:'Name and location are required'});
  try {const [r]=await db.query('INSERT INTO destination(destination_name,destination_location,destination) VALUES(?,?,?)',[destination_name,destination_location,destination||'']);res.status(201).json({message:'Destination added',id:r.insertId});}
  catch(e){res.status(500).json({message:e.message});}
});
app.post('/api/admin/packages',auth,admin,async(req,res)=>{
  const {packages_name,packages_duration,price,avaiable_slots}=req.body;
  if(!packages_name||!packages_duration||price==null||avaiable_slots==null)return res.status(400).json({message:'Fill all package fields'});
  try {const [r]=await db.query('INSERT INTO packages(packages_name,packages_duration,price,avaiable_slots) VALUES(?,?,?,?)',[packages_name,packages_duration,price,avaiable_slots]);res.status(201).json({message:'Package added',id:r.insertId});}
  catch(e){res.status(500).json({message:e.message});}
});
app.listen(PORT,()=>console.log(`Travel Booking System running at http://localhost:${PORT}`));
