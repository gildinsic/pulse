    var now = Date.now()
    var day = 1000*60*60*24
    var days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
    var months = ['Janvier','F  vrier','Mars','Avril','Mai','Juin','Juillet','Ao  t','Septembre','Octobre','Novembre','D  cembre']

    function getThenDate(ms) {
      const when = new Date(ms)
      return days[when.getDay()]+' '+when.getDate()+' '+months[when.getMonth()]+' '+when.getFullYear()
    }
    function getThenTime(ms) {
      const when = new Date(ms)
      return when.toLocaleTimeString()
    }
