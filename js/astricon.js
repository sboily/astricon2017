var socket = null;
var started = false;
var token = null;
var user_uuid = null;


if (token) {
  load_application(token);
} else {
  load_login();
}


function load_login() {

  $('#send_auth').on('click', function(e) {
    e.preventDefault();
    var data = $('#form_auth').serializeArray().reduce(function(obj, item) {
      obj[item.name] = item.value;
      return obj;
    }, {});

    login(data.username, data.password);
  });

  $('#sms').hide();
}


function login(username, password) {
  var body = {
    backend: 'xivo_user',
    expiration: 3600
  };

  fetch('https://quintana.wazo.community/api/auth/0.1/token', {
    headers: {
      'Authorization': 'Basic '+ btoa(username+':'+password)
    },
    method: 'POST',
    body: JSON.stringify(body)
  })
  .then((response) => response.json())
  .then((response) => {
    switch(response.status_code) {
      case 401:
        alert('Sorry you are not authenticated');
        break;
      default:
        load_application(response);
    }
  });
}

function load_application(data) {
  $('#auth').hide();
  $('#sms').show();

  if (!token) {
    token = data.data.token;
    user_uuid = data.data.xivo_user_uuid;
  }
  load_websocket(token);
  on_sms_send();
}

function on_sms_send() {
  $('#send_sms').on('click', function(e) {
    e.preventDefault();
    var sms = $('#send_sms_msg').val();
    $('#send_sms_msg').val('');
    send_sms(sms, '14188050723');
  });
}

function send_sms(msg, number) {
  var msg = '/sms ' + number + ' ' + msg;
  var msg = {
    alias: '+14188050723',
    msg: msg,
    to: user_uuid
  };

  fetch('https://quintana.wazo.community/api/ctid-ng/1.0/users/me/chats', {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Auth-Token': token
    },
    method: 'POST',
    body: JSON.stringify(msg),
  });
}

function on_sms_received(data) {
  var sms = data.data.msg;
  var sender = data.data.alias;
  var d = moment().format('MMMM Do YYYY, h:mm:ss a');
  var msg = sms + '<br/><small class="text-muted">' + sender + ' | '+ d + '</small>';

  var container = '<div class="media"><a class="pull-left" href="#"><img class="media-object img-circle" style="max-height:40px;" src="img/user.jpg" /></a><div class="media-body" id="sms_msg">'+msg+'</div></div>';

  $('#recv_sms_area').append(container);
  add_phone_history(sender);
}


function add_phone_history(number) {
  var d = moment().format('MMMM Do YYYY, h:mm:ss a');
  var phone = '<h5 id="'+number+'">'+number+'</h5><small class="text-muted">'+d+'</small>';
  var container = '<li class="media"><div class="media-body"><div class="media"><a class="pull-left" href="#"><img class="media-object img-circle" style="max-height:40px;" src="img/user.jpg" /></a><div class="media-body">' + phone + '</div></div></div></li>';

  $('#recv_phone_area').append(container);

}

function load_websocket(token) {
  if (socket != null) {
    console.log("socket already connected");
    return;
  }

  socket = new WebSocket("wss://quintana.wazo.community/api/websocketd/?token=" + token);
  socket.onclose = function(event) {
    socket = null;
    console.log("websocketd closed with code " + event.code + " and reason '" + event.reason + "'");
  };
  socket.onmessage = function(event) {
    if (started) {
      console.log("message received: " + event.data);
      var data = JSON.parse(event.data);
      if (data.name == 'chat_message_event' && data.data.to[1] == user_uuid) {
        if (data.data.msg.search('/sms') < 0) {
          on_sms_received(data);
        }
      }
      return;
    }

    var msg = JSON.parse(event.data);
    switch (msg.op) {
      case "init":
        subscribe("*");
        start();
        break;
      case "start":
        started = true;
        console.log("waiting for messages");
        break;
    }
  };
  started = false;
}

function subscribe(event_name) {
  var msg = {
    op: "subscribe",
    data: {
      event_name: event_name
    }
  };
  socket.send(JSON.stringify(msg));
};

function start() {
  var msg = {
    op: "start"
  };
  socket.send(JSON.stringify(msg));
}
