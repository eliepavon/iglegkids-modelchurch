const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');

const familyRoutes   = require('./routes/families');
const checkinRoutes  = require('./routes/checkins');
const checkoutRoutes = require('./routes/checkouts');
const eventRoutes    = require('./routes/events');
const childRoutes    = require('./routes/children');
const dashboardRoutes= require('./routes/dashboard');
const printRoutes    = require('./routes/print');
const notifyRoutes   = require('./routes/notify');
const reportRoutes   = require('./routes/reports');
const { errorHandler } = require('./middleware/errorHandler');
const { logger }       = require('./middleware/logger');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET','POST'] }
});

app.set('io', io);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '5mb' }));
app.use(logger);

const limiter  = rateLimit({ windowMs: 60000, max: 60 });
const ciLimiter= rateLimit({ windowMs: 60000, max: 30 });

app.use('/api/families',  limiter,   familyRoutes);
app.use('/api/checkins',  ciLimiter, checkinRoutes);
app.use('/api/checkouts', ciLimiter, checkoutRoutes);
app.use('/api/events',    limiter,   eventRoutes);
app.use('/api/children',  limiter,   childRoutes);
app.use('/api/dashboard', limiter,   dashboardRoutes);
app.use('/api/print',     limiter,   printRoutes);
app.use('/api/notify',    limiter,   notifyRoutes);
app.use('/api/reports',   limiter,   reportRoutes);

app.get('/health', (req, res) => res.json({
  status: 'ok',
  org: process.env.ORG_NAME || 'Model Church',
  timestamp: new Date().toISOString()
}));

app.use(errorHandler);

io.on('connection', socket => {
  socket.join('dashboard');
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`\n🏛️  IgleKids — Model Church`);
  console.log(`🚀 Corriendo en puerto ${PORT}\n`);
});

module.exports = { app, io };
