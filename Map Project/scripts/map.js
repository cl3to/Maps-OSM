
var traceRoute = false;
var map;

const routeController = {
    router : L.Routing.osrmv1(),
    display: null,
    orderStops: null,
    route: function(waypoints, callback){
        this.router.route(waypoints, callback);
    }
};

var markerBus = new Array;
var markerIAmHere;
var busStops = new Array;


var currentLatOnibus = new Array;
var currentLngOnibus = new Array;

var currentLatUsuario = -22.817113;
var currentLngUsuario = -47.069672;

var currentVelocOnibus = new Array;
var statusCoordinates = new Array;

var lastAddressArray = new Array;
var lastSendArray = new Array;
var lastSend = "";
var lastAddress = "";

var countCoordsIsNull = 0;

var inputchecked = false;
var noturno = false;
var idCircularLinha;
var idCirculino;

const LINHA_MORADIA = 5;
const LINHA_NOTURNO = 3;

var posicaoPontoInicial = L.latLng(-22.828016, -47.060825);
var posicaoCentroUnicamp = L.latLng(-22.821677, -47.065283);
var posicaoCentroUnicampMoradia = L.latLng(-22.819402, -47.073481);

setInterval(function(){

        if(map != null){

            if (countCoordsIsNull >=10){
                location.reload(true);
            }
    
            checkHorario();
    
            buscarPosicaoOnibus();
    
            if(statusCoordinates != 3 && idCircularLinha != LINHA_MORADIA){
                showWhereIsBus();
            }
        }

    }, 3000);


function checkHorario(){
    let now = new Date();
    noturno = (now.getHours() >= 18);
}

// enviando o form
function submitService(stringValue){

    let values = stringValue.split(';');
    idCircularLinha = values[0];
    idCirculino = values[1];

    resetMap();
    
    initMap();
}

function resetMap(){

    map.remove();

    document.getElementById("endereco").innerHTML = "";
    markerBus = new Array;
    currentLatOnibus = new Array;
    currentLngOnibus = new Array;
    busStops = new Array;
    setRouteMessage('');

    const divOpt = document.querySelector("#divOptions");
    const divRM = document.querySelector("#rotasMoradia");
    const btnRoute = document.querySelector('#traceRoute');

    if(idCircularLinha == LINHA_MORADIA){
        divOpt.style.display = 'none';
        divRM.style.display = 'inline';

        const legendaDiurno = document.querySelector('#legendaDiurno');
        const legendaNoturno = document.querySelector('#legendaNoturno');

        if(noturno) {
            legendaDiurno.style.display = 'none';
            legendaNoturno.style.display = 'inline';
        }
        else {
            legendaDiurno.style.display = 'inline';
            legendaNoturno.style.display = 'none';            
        }

        
        btnRoute.style.display = 'none';
    }

    else{

        divOpt.style.display ='inline';
        divRM.style.display = 'none'; 
        btnRoute.style.display = 'block';
    }
 
}

function getPosFromGPS(){
    var options = {enableHighAccuracy: true, maximumAge: 0};
    navigator.geolocation.getCurrentPosition(setLatLng, error, options);
}

//função para definir latitude e longitude atual do usuário
function setLatLng(position) {
    //var crd = position.coords;
    
    currentLatUsuario = position.coords.latitude;
    currentLngUsuario = position.coords.longitude; 

    putIAmHereMarker();

}

// função para retornar erro da geolocalizacao
function error(err) {
        console.warn('ERROR(' + err.code + '): ' + err.message);
}

// Inserir o KML das rotas no mapa, não funciona normalmente no navegador devido ao bloqueio da política de CORS
// Resolver o problema de CORS usando uma aba de navegador no-cors (serve apenas para teste)
function insertKML(){

    let urlKML = ""; 
    let option;

    if(idCircularLinha != LINHA_MORADIA){
        urlKML = 'https://www.prefeitura.unicamp.br/apps/site/kml/circular/'+idCircularLinha+'.kml?rev=5';
        
        //urlKML = './kmls/'+idCircularLinha+'.kml'; // Usando arquivo local
    }
    else{
        if(noturno){
            option = '-noturno';
        }
        else{
            option = '-diurno';
        }

        urlKML = 'https://www.prefeitura.unicamp.br/apps/site/kml/circular/' + LINHA_MORADIA + option + '.kml?rev=5';

        //urlKML = "./kmls/5-diurno.kml"; // Usando arquivo local devido a problema na leitura do kml
        
    }

    fetch(urlKML) // Instruções do plug-in de kml do leaf-leat
    .then(res => res.text())
    .then(kmltext => {
        // Create new kml overlay
        const parser = new DOMParser();
        const kml = parser.parseFromString(kmltext, 'text/xml');
        const track = new L.KML(kml);
        map.addLayer(track);

        // Adjust map to show the kml
        const bounds = track.getBounds();
        map.fitBounds(bounds);
    });    
}

function requireOrderStops() {

    if(idCircularLinha == LINHA_MORADIA){
        return;
    }
    
    let url = `./pontos/pontos_circular_${idCircularLinha}.json`;

    fetch(url)
    .then(res => res.json())
    .then(res => addOrderStops(res.pontos))
    .catch(err => console.error(err));

}

function addOrderStops(stops) {
    let orderStops = new Array;

    stops.forEach((e) => {
        let stop = {
            reference: e.referencia,
            order: e.ordem,
            position: L.latLng([e.latitude, e.longitude])
        };
        orderStops.push(stop);
    });

    routeController.orderStops = orderStops;
}

// Criação dos Marcadores de Pontos de ônibus
function initBusStops(){
    let url = 'https://www.prefeitura.unicamp.br/posicao/app/pontosCircular';
    
    fetch(url)
    .then(res => res.json())
    .then(res => res.pontos)
    .then(res => depurarPontos(res))
    
}

function depurarPontos(pontos){
    
    let ponto = pontos[0];
    let arrHorarios = new Array;
    for(let i = 0; i < pontos.length; i++){
        
        if(pontos[i].idCircularLinha == idCircularLinha){
            if(pontos[i].idCircularPonto != ponto.idCircularPonto){
                createBusStop(( i-1 >= 0) ? pontos[i-1] : ponto, arrHorarios);
                ponto = pontos[i];
                arrHorarios = new Array;
            }

            arrHorarios.push(pontos[i].horario); // Não registra o último ponto
        }

        // Sabendo que o Array vem em ordem crescente de linhas de ônibus
        else if(pontos[i].idCircularLinha > idCircularLinha){
            createBusStop(ponto, arrHorarios);
            return;
        }    
    }
}

function createBusStop(ponto, horariosPonto){

    let coordenadas = L.latLng(ponto.latitude, ponto.longitude);
   
    let icon = L.icon({
        iconUrl: "./img/buildings.png",
        iconSize: [20,32]
    });

    let options = {
            title: ponto.referencia,
            icon: icon,
            zIndexOffset: 900, // Posição z abaixo a do ônibus
            draggable: false
    };        
    
    let busStop = L.marker(coordenadas, options);

    let popup = L.popup({maxWidth: 350});

    let cobertura = "";
    if(ponto.isCobertura){
        cobertura = "Este ponto possui cobertura.";
    }

    let horarios = (horariosPonto.length > 0) ? "" : "Este ponto não possui horários na próxima 1 hora.";
    let horario;

    for(let i = 0; i < horariosPonto.length; i++){
        horario = horariosPonto[i].slice(0,5);
        horarios += horario;
        if(ponto.isOnibusAdaptado){
            horarios += "<img src=img/cadeirante.jpg style=\"width: 13px; height: 13px; margin-left: 3px;\">";
        }
        if(i != horariosPonto.length -1){
            horarios += " - ";
        }
        
    }

    searchImage(ponto, popup, horarios);

    busStop.bindPopup(popup);
    busStop.addTo(map);

    let stop = {
        id: ponto.idCircularPonto,
        unidade: ponto.unidade,
        referencia: ponto.referencia,
        marker: busStop,
        itinerary: horariosPonto
    }

    busStops.push(stop);
}

function searchImage(ponto, popup, horarios) {
    fetch('searchImage.php', {
        method: 'POST',
        body: new URLSearchParams(`fileName=${ponto.idCircularPonto}`)
    })
     .then(res => res.text())
     .then(res => setPopupContent(popup, ponto, horarios, res))
     .catch(error => console.error(error));
}

function setPopupContent(popup, ponto, horarios, imageURL){

    let cobertura = (ponto.isCobertura) ? "Este ponto possui cobertura." : "";

    let content = "<table border=\"0\" width=\"350\" style=\"font-size: 13px;\">" + "<tr>" + "<td colspan=\"2\" align=\"center\" style=\"font-size: 15px;\"><b>" + ponto.unidade + " </b><br/></td>" + "</tr> " + "<tr>" + "<td  align=\"center\">" + ponto.referencia + "</td>" + "</tr> " + "</tr> " + "<tr>" + "<td  align=\"center\"><img src=\""+imageURL+"\" style=\"max-width: 80%; max-height: 80%;\"></td>" + "</tr> " + "<tr>" + "<td  align=\"center\" ><b>Horários do " + ponto.descricao + "</b></td>" + "</tr> " + "<tr>" + "<td  align=\"center\">" + horarios + "</td>" + "</tr> " + "<tr>" + "<td  align=\"center\" style=\"font-weight: bold;\">" + cobertura + "</td>" + "</tr> " + "<tr>" + "<td  align=\"center\" style=\"font-size: 13px;\"><img src=img/cadeirante.jpg style=\"width: 15px; height: 15px;\"> <font color=\"#0000FF\">Viagens com &#244;nibus adaptado para deficientes f&#237;sicos</font></td>" + "</tr> " + "</table>";

    popup.setContent(content);
}

function searchInput() {

    checkHorario();

    const url = 'https://www.prefeitura.unicamp.br/posicao/app/circulinosAtuando';

    fetch(url)
    .then(res => res.json())
    .then(res => res.circulinos)
    .then(res => createInputs(res));
}

function createInputs(linhas){
    const fLinha = document.querySelector('#filtroLinha');
    
    fLinha.innerHTML = "";

    for(let i  = 0; i < linhas.length; i++){   
        insetInput(linhas[i], fLinha);
    }

    initialize();
}

function insetInput(linha, form){

    const input = document.createElement("input");
    const label = document.createElement('label');
    const div = document.createElement('div');
    const img = document.createElement('img');

    input.type = 'radio';
    input.id = 'tipoLinha'+linha.idCirculino;
    input.name = 'tipoLinha';
    input.value = `${linha.idCircular};${linha.idCirculino}`;
    input.addEventListener("change", function(){submitService(this.value);});

    if(linha.idCircular == 1 && !inputchecked){
        input.checked = true;
        defineIds(linha.idCircular, linha.idCirculino);
        inputchecked = true;
    } else if(noturno && linha.idCircular == LINHA_NOTURNO && !inputchecked){
        input.checked = true;
        defineIds(linha.idCircular, linha.idCirculino);
        inputchecked = true;
    } else if(linha.idCircular == 2 && !inputchecked){
        input.checked = true;
        inputchecked = true;
        defineIds(linha.idCircular, linha.idCirculino);        
    }

    label.htmlFor = input.id;
    label.id = 'lbl-'+'linha'+linha.idCircular;
    label.textContent = (linha.idCircular == LINHA_MORADIA ? " Ônibus ": " ") + linha.descricao;

    if(linha.idCircular != LINHA_MORADIA){
        
        img.src = 'img/cadeirante.jpg';
        img.style = "width: 13px; height: 13px; margin-left: 3px;";
    
        label.appendChild(img);    
    }


    div.className = 'linhas';
    div.appendChild(input);
    div.appendChild(label);

    form.appendChild(div);


}

function defineIds(idLinha, idBus){
    idCircularLinha = idLinha;
    idCirculino = idBus;
}

function eventTraceRoute(){
    const btn = document.querySelector('#traceRoute');
    btn.addEventListener('click', route);
}

function initialize(){

    setLocation();

    if (map == null){
        initMap();
    }

    eventQualCircularPegar();
    eventTraceRoute();
    
}

// Inicializar mapa e suas camadas auxiliares
function initMap(){

    let center = idCirculino != LINHA_MORADIA ? posicaoCentroUnicamp : posicaoCentroUnicampMoradia;

    let options = {
        center: center,
        zoom: (idCircularLinha != LINHA_MORADIA ? 15 : 14),
        fullscreenControl: true
    }

    map = L.map('mymap', options);

    // Camada de Mosaico do mapa
    let CartoDB_Voyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    });

    CartoDB_Voyager.addTo(map);

    insertKML();
    initBusStops();
    requireOrderStops();
    putBusMarker();
    putIAmHereMarker();

    buscarPosicaoOnibus();   
    map.addEventListener('zoom', setVisibleMarkers); 

}

// usar a localização real do Usuário no mapa
function setLocation(){

    var obj = document.getElementsByName("myLocal");

    if (obj[0].checked){	
        currentLatUsuario = -22.817113;
        currentLngUsuario = -47.069672;
    
    } else if (obj[1].checked){ 
        
        if (navigator.geolocation) {
            getPosFromGPS();
        } else {
            document.getElementById("container").innerHTML = '<p align="center">Sinto muito, mas o servi&#231;o de geolocaliza&#231;&#227;o n&#227;o &#233; suportado por seu navegador.</p>';
        }
    } 

    putIAmHereMarker();

    if(map == null){
        initMap();
    }
        
}

//Função para colocar o marcador do ônibus
function putBusMarker() {

    for(var i = 0; i < currentLatOnibus.length; i++){

        if(markerBus[i] != null){
            markerBus[i].removeFrom(map);
        }

        if(map != null){
            let busPosition = L.latLng(currentLatOnibus[i], currentLngOnibus[i]);
            
            let options = {
                zIndexOffset: 1000,
                draggable: false
            };
            
            markerBus[i] = L.marker(busPosition, options);

            if(statusCoordinates[i] == 1){
                let busIcon = L.icon({
                    iconUrl: "./img/bus.png",
                    iconSize: [24, 32]
                });

                markerBus[i].setIcon(busIcon);
            }

            else if(statusCoordinates[i] == 2){
                let busIcon = L.icon({
                    iconUrl: "./img/busEstimatePos.png",
                    iconSize: [24, 32]
                }); 

                markerBus[i].setIcon(busIcon);           
            }

            else if(statusCoordinates[i] == 3){
                let busIcon = L.icon({
                    iconUrl: "./img/busNoConnection.png",
                    iconSize: [24, 32]
                }); 

                markerBus[i].setIcon(busIcon);                
            }
            
            markerBus[i].addTo(map);
        }
    }

    var centralizarNoOnibus = document.getElementById("chkCentralizarNoOnibus");
        
    // centralizar o mapa
    if (centralizarNoOnibus.checked){		
        if (!isNaN(markerBus[0].getLatLng().lat && !isNaN(markerBus[0].getLatLng().lng))){
            if (idCircularLinha != LINHA_MORADIA) {map.setView(markerBus[0].getLatLng());}
            else {}
        }
    }
    
}

// Função para colocar o marcador do usuário
function putIAmHereMarker(){

    //remover o marcador do mapa
    if(markerIAmHere != null) {
        markerIAmHere.removeFrom(map);
    }

    if(map != null){
        let userPosition = L.latLng(currentLatUsuario, currentLngUsuario);
        
        let options = {
            title: 'Arraste o marcador para indicar onde você está',
            icon: L.icon({iconUrl: './img/iamhere.png', iconSize: [50,50]}),
            zIndexOffset: 1000,
            draggable: true
        }; 
        
        markerIAmHere = L.marker(userPosition, options);

        let popUp = L.popup();
        popUp.setContent('Voc&#234; est&#225; aqui.');
        markerIAmHere.bindPopup(popUp);

        markerIAmHere.addEventListener('click', function(){
                                        markerIAmHere.openPopup();
                                        });
        
        markerIAmHere.addEventListener('dragend', function(){
                                        currentLatUsuario = markerIAmHere.getLatLng().lat;
                                        currentLngUsuario = markerIAmHere.getLatLng().lng;
                                        refreshDivModal();
                                    });  
        
        markerIAmHere.addTo(map);
        refreshDivModal();                                

    }
}

// Função para buscar e atualizar a posição do ônibus
function buscarPosicaoOnibus(){

    //Linhas internas
    if (idCircularLinha != LINHA_MORADIA){
        
        let url = 'https://www.prefeitura.unicamp.br/posicao/site/linha/'+idCircularLinha+'/circulino/'+idCirculino;

        fetch(url)
        .then(res => res.json())
        .then(data => {
                        currentLatOnibus[0] = data.latitude;
                        currentLngOnibus[0] = data.longitude;
                        currentVelocOnibus[0] = data.velocidadeMedia;
                        statusCoordinates[0] = data.status; 
                        lastAddressArray[0] = data.endereco;
            
                        if(currentLatOnibus[0] == null || currentLngOnibus[0] == null) {
                            countCoordsIsNull++;
                        }
                        
                        else {
                            countCoordsIsNull = 0;
                            putBusMarker(idCircularLinha);
                        }
                    })
        .catch(error => console.log(error));
    }

    //linha moradia
    else {
        
        let url = 'https://www.prefeitura.unicamp.br/posicoes/site/linha/'+idCircularLinha;
        
        fetch(url)
        .then(res => res.json())
        .then(data => {

                        currentLatOnibus = [];
                        currentLngOnibus = [];
                        statusCoordinates = [];

                    
                        for(let i = 0; i < data.posicoes.length; i++) {

                            currentLatOnibus.push(data.posicoes[i].latitude);
                            currentLngOnibus.push(data.posicoes[i].longitude);
                            statusCoordinates.push(data.posicoes[i].status);
                            currentVelocOnibus.push(data.posicoes[i].velocidadeMedia);
                            lastAddressArray.push(data.posicoes[i].endereco); 
                        
                        }

                        putBusMarker(idCircularLinha);
                        
                    })
        .catch(error => console.log(error));
    }

}

function onibusEstaPontoInicial(){
    let busPos = L.latLng(currentLatOnibus[0], currentLngOnibus[0]);
    return (distanceAtoB(busPos, posicaoPontoInicial) <= 120);
}

function usuarioEstaPontoInicial(){
    let userPos = L.latLng(currentLatUsuario, currentLngUsuario);
    return(distanceAtoB(userPos, posicaoPontoInicial) <= 120);
}

// Função que retorna a distância em metros entre dois pontos
function distanceAtoB(pointA, pointB){
			
    latOrigem = pointA.lat; 
    lngOrigem = pointA.lng;

    latDestino = pointB.lat;
    lngDestino = pointB.lng;

    
    distancia = 6371000*Math.acos(Math.cos(Math.PI*(90-latDestino)/180)*Math.cos((90-latOrigem)*Math.PI/180)+Math.sin((90-latDestino)*Math.PI/180)*Math.sin((90-latOrigem)*Math.PI/180)*Math.cos((lngOrigem-lngDestino)*Math.PI/180));

    return distancia;
}

function setVisibleMarkers(){

    var value;
    
    if (map.getZoom() < (idCircularLinha != LINHA_MORADIA ? 15 : 14)) {
        value = 0;
    } else {
        value = 1;
    }
    
    for (i=0; i<busStops.length; i++) {
        busStops[i].marker.setOpacity(value);
    }

    markerIAmHere.setOpacity(value);
}

// Corrigir arredondamento quando o último dígito for cinco
function fixRounding(value) {

    var strDistance = value.toString();
    var digit = strDistance.charAt(strDistance.length-1);
    
    if (digit == '5'){
        return 0.001;
    } else if (digit == '4') {
        return 0.002;
    }

    return 0;
}

function showWhereIsBus(){

    var msg = "";

    msg ='<span style="font-weight: bold">Atualmente o &#244;nibus est&#225; em ' + lastAddressArray[0];
    
    if (onibusEstaPontoInicial() && lastAddress.indexOf("Sabin") != -1){
        msg += " (ponto inicial).";
    }

    msg += '</span>';
    msg += '<br/><span style="font-weight: bold">A velocidade média atual é ' + currentVelocOnibus[0].toString() + ' km/h.</span>';

    document.getElementById("endereco").innerHTML = msg;  

}

function refreshDivModal(){
    let link = "https://www.prefeitura.unicamp.br/apps/site/qualCircular.php?currentLatUsuario="+currentLatUsuario+"&currentLngUsuario="+currentLngUsuario;

    fetch(link)
    .then(res => res.arrayBuffer())
    .then(buffer => decodeString(buffer));
}

function decodeString(buffer) {
    let decoder = new TextDecoder('iso-8859-1');
    let text = decoder.decode(buffer);
    refreshModal(text);
}

function refreshModal(text){
    const divModal = document.querySelector('#modalContentQualCircular');
    divModal.innerHTML = text;
    myModalSubmit();
}

function eventQualCircularPegar() {

    const modal = document.querySelector('#myModal'); 
    const btn = document.querySelector('#qualCircular');
    const closeSpan = document.querySelector('.close');

    btn.addEventListener('click', function(){
        modal.style.display = 'block';
        document.getElementById("resultadoQualCircular").innerHTML = ''; 

    });
    
    closeSpan.addEventListener('click', function(){
        modal.style.display = 'none';
    })

    window.onclick = function(event){
        if(event.target == modal){
            modal.style.display = 'none';
        }
    }

}

function myModalSubmit() {
    const frmBusca = document.querySelector('#frmBusca');
    frmBusca.addEventListener('submit', e => {
        e.preventDefault();
        fetch('qualCircular_busca.php',{method: 'POST'})
        .then(res => res.text())
        .then(text => {
            const resQbusca = document.querySelector('#resultadoQualCircular');
            resQbusca.innerHTML = text;
        });
    });
}

function checkItinerary(start, end) {
    let sn1 = parseInt(busStops[start].itinerary[0].slice(0,2));
    let startNum = parseInt(busStops[start].itinerary[0].slice(3,5));
    let en1 = parseInt(busStops[end].itinerary[0].slice(0,2));
    let endNum = parseInt(busStops[end].itinerary[0].slice(3,5));
    if(startNum > endNum || sn1 > en1){
        if(busStops[end].itinerary[1] != null){
            return busStops[end].itinerary[1].slice(0,5);
        }
    }
    return busStops[end].itinerary[0].slice(0,5);
}

function getNearStop(target) {
    let targetPosition = target.getLatLng();
    let stopPosition;
    let distance = 9999999999;
    let distanceAux;
    let index = -1;
    
    routeController.orderStops.forEach((e, i) => {
        stopPosition = e.position;
        distanceAux = distanceAtoB(stopPosition, targetPosition);
        if(distanceAux < distance){
            distance = distanceAux
            index = i;
        }
    })

    return index;
}

function getBusStop(index) {

    let reference  = routeController.orderStops[index].reference;
    let newIndex = -1;

    busStops.forEach((e, i) => {
        if(e.referencia == reference){
            console.log(e.referencia);
            newIndex = i;
        }
    })
    
    return newIndex;
}

function setRouteMessage(message){
    const div = document.querySelector('#details');
    div.innerHTML = '<span style="font-weight: bold">' + message + '</span>';
}

function showRoute(error, routes) {
    if(error != null) {
        console.log(error);
        return;
    }

    const route = routes[0];

    routeController.display = L.Routing.line(route);

    let distance = route.summary.totalDistance / 1000;
    let duration = route.summary.totalTime / 60;

    let message = 'A dist&#226;ncia do &#244;nibus at&#233; o ponto mais pr&#243;ximo a voc&#234; &#233; ' + distance.toFixed(2) +
    ' km com previs&#227;o de chegada em ' + Math.ceil(duration) + ' minutos.';

    setRouteMessage(message);

    routeController.display.addTo(map);

}

// Traçar a rota e exibir distância e tempo
function route() {

    let start = getNearStop(markerBus[0]);
    let end = getNearStop(markerIAmHere);
    let message = "";

    let userStop = getBusStop(end);
    let busStop = getBusStop(start);

    console.log(userStop);
    console.log(busStop);

    if(routeController.display != null){
        routeController.display.remove();
        routeController.display = null;
    }

    if(usuarioEstaPontoInicial()){
        message = "Voc&#234; est&#225; no ponto inicial."
        message += `<br/>Pr&#243;ximo Hor&#225;rio de Sa&#237;da do &#244;nibus: ${busStops[userStop].itinerary[0].slice(0,5)}`;
        setRouteMessage(message);
    }

    else if(onibusEstaPontoInicial()) {
        message = `O &#244;nibus est&#225; no ponto inicial.`;
        message += `<br/>Pr&#243;ximo Hor&#225;rio de Sa&#237;da do &#244;nibus: ${busStops[busStop].itinerary[0].slice(0,5)}`;
        message += `<br/>A previs&#227;o de chegada em ${busStops[userStop].referencia} s&#227;o &#224;s ${checkItinerary(busStop, userStop)}.`
        setRouteMessage(message);
    }

    else if(end - start == 1){
        message = `O &#244;nibus est&#225; chegando ao ponto ${busStops[userStop].referencia}.`;
        setRouteMessage(message); 
    }

    else if(start >= end){
        message = "O &#244;nibus j&#225; passou pelo ponto mais pr&#243;ximo de voc&#234;.<br/>";
        message += "Experimente arrastar o marcador para um outro ponto.";
        setRouteMessage(message);
    }

    else if(start < end) {
        let waypoints = new Array;
        let counter = 0;

        waypoints[counter++] = L.Routing.waypoint(markerBus[0].getLatLng());
        for(let i = start+1; i <= end; i++) {
            waypoints[counter++] = L.Routing.waypoint(routeController.orderStops[i].position, routeController.orderStops[i].reference);
        }
        console.log(waypoints);
        routeController.route(waypoints, showRoute);
    }
    

}