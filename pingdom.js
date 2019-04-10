#!/home/monitor/.nvm/versions/node/v10.7.0/bin/node

const fs = require("fs")
fs.writeFileSync('/run/monitor/monitor.pingdom.pid',process.pid)

const common = require('../common/lib')

// --------------  REDIS BUS --------------------

var redis = require("redis")
var db = redis.createClient()

// --------------  EVENTS -----------------------

var events = require('events');
var watcher = new events.EventEmitter();

// --------------  PINGDOM ----------------------

var api = require('./pingdom.api.js')

const trace = false

var checks = { }

watcher.on('perf',function(mode,check) {
  api.performance(mode,check.id,
  function(perf) {
    if(!perf) { return; }
    check[mode] = perf
    if( check['hour'] && check['day'] && check['week'] ) {
      watcher.emit('publish',check);
    }
  },
  function(ctx) {
    console.log('err perf',ctx)
  })
})

watcher.on('check',function(check) {
  api.check(check.id,
  function(check) {
    if( trace && check.id=="your monitor" ) {
      console.log('check=================================',check)
    }
    if(!check) { return console.log('no check',check.id); }
    watcher.emit('perf','hour',check);
    watcher.emit('perf','day' ,check);
    watcher.emit('perf','week',check);
  },
  function(ctx) {
    console.log('err check',ctx)
  })
})

watcher.on('publish',function(check) {
  check && db.publish('pingdom',JSON.stringify(check));
})

watcher.on('checks',function() {
  api.checks(
  function(ctx) {
    if(trace) { console.log('done checks',ctx.cnt); }
  },
  function(ctx,check) {
    const id = check.id
    if(trace && check.id=="your monitor ID") {
      console.log('iter checks',check)
    }
    watcher.emit('check',check)
  },
  function(ctx) {
    console.log('err checks')
  })
})

setInterval(function() {
  watcher.emit('checks')
},60*1000)
watcher.emit('checks')

