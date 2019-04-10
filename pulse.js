#!/home/monitor/.nvm/versions/node/v10.7.0/bin/node

const fs = require('fs')
fs.writeFileSync('/run/monitor/monitor.pulse.pid',process.pid)

const common = require('../common/lib')

var redis = require("redis")
var db = redis.createClient()

var api = require('./pingdom.api.js')

// NOT PUBLIC
var d2json = require('./d2json.js')
var checks2csv = require('./checks2csv.js')
// NOT PUBLIC 


// --------------  EVENTS -----------------------

var events = require('events');
var watcher = new events.EventEmitter();

// --------------  EXPRESS ----------------------

var express = require('express')
var app = express()

var http = require('http')
var server = http.createServer(app)

// ----- DASHBOARD -----

function line(id) {

  const check = checks[id]
  if(!check) { return null; }

  var x = { }
  var data = d2json[check.name]
  if(typeof data === 'undefined') { return null; }

  x.id             = check.name

// not public
//  x.truc1      = data.truc1
  x.groupe         = data.groupe
// not public
//  x.truc2      = data.truc2
//  x.truc3      = data.truc3
  x.volumetrie     = data.volumetrie
  x.tag            = check.tag
  x.url            = check.url2
  x.up             = check.status

  if(!check['hour']) { return null; }
  x.hscore = check['hour'].score

  if(!check['day']) { return null; }
  x.dscore = check['day'].score

  if(!check['week']) { return null; }
  x.wscore = check['week'].score

  return x
}

function lines() {
  var x = []
  for(var i=0;i<checks.ids.length;i++) {
    var check = checks.ids[i]
    if(i==0) console.log('check',check)
    if(typeof check === "undefined") { continue; }
    var xx = line(check)
    if(xx) { x.push(xx); }
  }
  return x;
}

// ----------------  CSV  -----------------------

const wait = 5*60*1000

const trace = false

var checks = { ids:[] }

function upscore(uptime) {
  var upsc = -6
  if(uptime>=99.9) { upsc = 6; } else
  if(uptime>=99.5) { upsc = 4; } else
  if(uptime>=99.0) { upsc = 3; } else
  if(uptime>=98.0) { upsc = 2; } else
  if(uptime>=95.0) { upsc = 0; }
  return upsc
}

function rpscore(rtt) {
  var rpsc = -4
  if(rtt< 200) { rpsc =  4; } else
  if(rtt< 400) { rpsc  = 3; } else
  if(rtt< 600) { rpsc =  2; } else
  if(rtt< 800) { rpsc =  1; } else
  if(rtt<1000) { rpsc =  0; }
  return rpsc
}

function doscore(check,mode) {
  var perf = check[mode]
  perf.upscore = upscore(perf.dispo)
  perf.rpscore = rpscore(perf.rptime)
  perf.score   = perf.upscore+perf.rpscore
  if(trace && check.id=="your monitor id") {
    console.log('doscore check',mode,perf)
  }
}

var handlebars = require("express-handlebars")
app.engine('hbs',handlebars({}))
app.set('view engine','hbs')


app.use('/js' ,express.static('js'));
app.use('/png',express.static('png'));
app.use('/svg',express.static('svg'));
app.use('/tl' ,express.static('timeline'));



// ----- DASHBOARD -----

// errors

const tryagain    = 'Essaye encore !'             // 503
const whatthefuck = 'Je ne vous comprends pas !'  // 404
const goodboy     = 'Good boy !'                  // 200



app.use(function (req, res, next) {
  res.locals.ua = req.headers['user-agent'].toLowerCase()
  const webkit   = res.locals.ua.indexOf('webkit')>0
  const chrome   = res.locals.ua.indexOf('chrome')>0
  if(webkit || chrome) {
    console.log('Webkit or Chrome OK', res.locals.ua)
  }
  return next()
})
app.all('*',function(req,res,next) {
  next()
})
app.get('/',function(req,res) {
  return res.render('index2',{ })
})
app.get('/2',function(req,res) {
  return res.sendFile(__dirname+'/index2.html');
})
app.get('/34',function(req,res) {
  if(!checks.ready) { return res.status(503).end(tryagain); }
  if(!checks.ids)   { return res.status(404).end(whatthefuck); }
  var ok = 0;
  for(var i=0;i<checks.ids.length;i++) {
    const id = checks.ids[i]
    const check = checks[id]
    if( id=="your monitor id" || id==="your monitor id" ) {
      trace && console.log('check',id,check)
    }
    if(check.status==='up') { ok++; }
  }
  trace && console.log('ok is',ok)
  var icon;
  const rate = ok / checks.ids.length;
  if(rate>=0.99) { icon = 'vert';   } else
  if(rate>=0.95) { icon = 'orange'; } else { icon = 'rouge';  }
  const llines = lines()
  res.render('index3',{ lines:llines, rate:rate, icon:icon })
})


// ----- API -----

const API = "/api/v1"

const services = [
  { requete:'GET', route:'/ids',         description: 'tableau de type mime  "application/json"  des identifiants numériques des tests de service' },
  { requete:'GET', route:'/tags',        description: 'tableau de type mime  "application/json"  des tags des tests de service' },
  { requete:'GET', route:'/csv/:id',     description: 'extract de type mime  "text/plain UTF-8"  du service dont l\'identifiant de test est <id>' },
  { requete:'GET', route:'/score/:id',   description: 'valeur numérique de type mime  "text/plain UTF-8"  du score composite du service dont l\'identifiant de test est <id>. Intégrable dans une cellule MS Excel' },
]
const errors = [
  { code:404, description: 'mauvaise URL ou problème de paramètre' },
  { code:503, description: 'service indisponible, en cours de mise à jour, réssayer dans 1 minute' },
]


app.get('/api',function(req,res) {
  res.redirect(API)
})
app.get(API,function(req,res) {
  res.end('')
})
app.all('*',function(req,res,next) {
  if(checks.ready) { return next(); }
  res.setHeader('retry-after',5)
  res.status(503).end('')
})
app.get(API+'/ids',function(req,res) {
  if(!checks.ids) { return res.status(404).end(whatthefuck); }
  res.json(checks.ids)
})
app.get(API+'/tags',function(req,res) {
  res.json(api.tags)
})
app.get(API+'/csv',function(req,res) {
  const fn = "\"your dest file.csv\""
  res.writeHead(200,{
    'content-type':'text/plain; charset=utf-8',
    'content-disposition': 'attachment; filename='+fn
  })
  checks2csv(checks,
    function(head) { res.write(head); },
    function(line) { res.write(line); }
  )
  res.end('')
})

app.get(API+'/csv/:id',function(req,res) {
  const id = req.params.id
  const fn = "\"your 1 dest file"+id+".csv\""
  res.writeHead(200,{
    'content-type':'text/plain; charset=utf-8',
    'content-disposition': 'attachment; filename='+fn
  })
  var lchecks = { ids:[id] }
  lchecks[id] = checks[id]
  checks2csv(lchecks,
    function(head) { res.write(head); },
    function(line) { res.write(line); }
  )
  res.end('')
})
app.get(API+'/score/:id',function(req,res) {
  const id = req.params.id
  if(!checks[id]) { return res.status(404).end(whatthefuck); }
  res.setHeader('content-type','text/plain; charset=utf-8')
  res.write(''+checks[id].week.score)
  res.end('')
})

app.listen(3008,function() {
  console.log('listening on 3008')
})


// --------------------------------------------------

var sub = redis.createClient()
sub.on("message", function (channel, message) {
  if(channel!=='pingdom') { return; }
  var check = null;
  try {
    check = JSON.parse(message)
  } catch(e) {
    console.log('Pb to parse message',message)
  }
  if( trace && check.id==5091483 ) {
    console.log('pingdom check',check)
  }
  if(!checks[check.id]) { checks.ids.push(check.id); }
  checks[check.id] = check
  doscore(check,'hour')
  doscore(check,'day' )
  doscore(check,'week')
});
sub.subscribe("pingdom");

setTimeout(function() { checks.ready = true; },2*1000)
