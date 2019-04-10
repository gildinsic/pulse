#!/home/monitor/.nvm/versions/node/v10.7.0/bin/node

var request = require("request")

var debug = require("debug")("pingdomapi")
const dbg = "pingdom.api"

// --------------  PINGDOM API ------------------

const key = "YOURKEY"

const usr = "your email"
const pwd = "your pwd"

const api = "https://api.pingdom.com/api/2.1/"


const auth  = { user:usr, pass:pwd }
const tls   = { secureProtocol: "TLSv1_2_method" }
const app   = { 'App-Key' : key }

// --------------  EVENTS -----------------------

function dts(utime) {
  var utt
  try {
    utt = new Date(utime*1000)
  } catch(e) {
    debug(dbg,'dts',utime)
    return null
  }
  return utt.toISOString()
}

// --------------  APPELS -----------------------

function getOptions(url) {
  return { url:api+url, auth: auth, agentOptions: tls, headers: app }
}

function newcheck(secure,name,host,url,callback,cberr) {
  var ctx = { api:'newcheck' }
  if(!callback) { return cberr && cberr(ctx); }
  const url = "checks?type=http&encryption="+secure+"&name="+name+"&host="+host+"&url="+url
  ctx.options = getOptions(url)
  request.post(ctx.options,function (error, response, body) {
    if(error) {
      ctx.error = error
      debug(dbg,'newcheck',ctx)
      if(response) { ctx.status = response.statusCode; return cberr && cberr(ctx); }
      return cberr && cberr(ctx)
    }
    ctx.status = response.statusCode
    var res
    try {
      ctx.body = body
      res = JSON.parse(body)
    } catch(e) {
      ctx.error = 'json parse'
      debug(dbg,'newcheck',ctx)
      return cberr && cberr(ctx)
    }
    callback(res,ctx)
  })
}

function checks(done,cbiter,cberr) {
  var ctx = { api:'checks' }
  if(!done) { return cberr && cberr(ctx); }
  ctx.options = getOptions("checks?include_tags=true&showencryption=true&include_severity=true")
  request.get(ctx.options,function (error, response, body) {
    if(error) {
      ctx.error = error
      debug(dbg,'checks',ctx)
      if(response) { ctx.status = response.statusCode; return cberr && cberr(ctx); }
      return cberr && cberr(ctx)
    }
    ctx.status = response.statusCode
    var res
    try {
      ctx.body = body
      res = JSON.parse(body)
    } catch(e) {
      ctx.error = 'json parse'
      debug(dbg,'checks',ctx)
      return cberr && cberr(ctx)
    }
    if(!res.checks) {
     return cberr && cberr(ctx)
    }
    ctx.cnt = res.checks.length
    var ids = []
    for(var i=0;i<res.checks.length; i++) {
      const check = res.checks[i]
      ctx.i = i; ctx.id = check.id;
      cbiter && cbiter(ctx,check)
      if(!check.id) { cberr && cberr(ctx); continue; }
      ids.push(check.id)
    }
    done && done(ctx)
  })
}

function check(id,callback,cberr) {
  var ctx = { api:'check' }
  if(!callback) { return cberr && cberr(ctx); }
  ctx.options = getOptions("checks/"+id)
  request.get(ctx.options,function (error, response, body) {
    if(error) {
      ctx.error = error
      debug(dbg,'check',ctx)
      if(response) { ctx.status = response.statusCode; return cberr && cberr(ctx); }
      return cberr && cberr(ctx)
    }
    ctx.status = response.statusCode
    var parsed
    try {
      ctx.body = body
      parsed = JSON.parse(body)
    } catch(e) {
      ctx.error = 'json parse'
      debug(dbg,'check',ctx)
      return cberr && cberr(ctx)
    }
    var res = parsed.check
    if(!res) {
      ctx.error = 'no parsed check'
      debug(dbg,'check',ctx)
      return cberr && cberr(ctx)
    }
    if(!res.type || !res.type.http) {
      ctx.error = 'no type or http'
      debug(dbg,'check',ctx)
      return cberr && cberr(ctx)
    }
    var check = { id:id }
    check.tag    = (res.tags.length>0) ? res.tags[0].name : null
    check.name   = res.name
    check.host   = res.hostname
    check.url    = res.type.http.url
    check.secure = res.type.http.encryption
    check.url2   = 'http'+(check.secure?'s':'')+'://'+check.host+check.url
    check.status = res.status
    check.ltime  = dts(res.lasttesttime)
    check.lrptime= res.lastresponsetime
    callback(check,ctx)
  });
}

function performance(mode,id,callback,cberr) {
  var ctx = { api:'perf' }
  if(!callback) { return cberr && cberr(ctx); }
  //console.log('perf',mode,id)
  ctx.mode = mode
  switch(mode) {
  case 'hour': break;
  case 'day':  break;
  case 'week': break;
  default: return cberr && cberr(ctx);
  }
  const url = "summary.performance/"+id+"?includeuptime=true&resolution="+mode
  ctx.options = getOptions(url)
  request.get(ctx.options,function (error, response, body) {
    if(error) {
      ctx.error = error
      debug(dbg,'perf',ctx)
      if(response) { ctx.status = response.statusCode; return cberr && cberr(ctx); }
      return cberr && cberr(ctx)
    }
    ctx.status = response.statusCode
    var parsed
    try {
      ctx.body = body
      parsed = JSON.parse(body)
    } catch(e) {
      ctx.error = 'json parse'
      debug(dbg,'perf',ctx)
      return cberr && cberr(ctx)
    }
    var perf = parsed.summary
    if(!perf) {
      ctx.error = 'no parsed summary'
      debug(dbg,'perf',ctx)
      return cberr && cberr(ctx)
    }
    var last;
    switch(mode) {
    case 'hour':  last = perf.hours[0]; break;
    case 'day' :  last = perf.days[0];  break;
    case 'week':  last = perf.weeks[0]; break;
    default: break;
    }
    if(!last) {
      ctx.error = 'no perf:'+mode
      debug(dbg,'perf',ctx)
      return cberr && cberr(ctx)
    }
    var check = { }
    check.time    = dts(last.starttime)
    check.rptime  = last.avgresponse
    check.uptime  = last.uptime
    check.dntime  = last.downtime
    check.dispo   = 100
    if(last.downtime>0)
    check.dispo   = (1-(last.downtime/last.uptime))*100
    callback(check,ctx)
  })
}


module.exports = {
  checks:checks,
  check:check,
  newcheck:newcheck,
  performance:performance,
}
