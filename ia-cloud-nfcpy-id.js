module.exports = function(RED) {
    'use strict';
    var nfcpyid = require('node-nfcpy-id').default;

    function nfcpyidNode(n) {
        RED.nodes.createNode(this,n);
        this.waitTime   = n.waitTime * 1000;
        this.sendTime   = n.sendTime * 1000;  // 一回の送信をまとめる時間
        var node        = this;
        var nfc         = new nfcpyid({mode:'non-touchend'}).start();
        var startTime   = false;              // 10秒ポーリング開始時間
        var cardArray   = [];                 // メッセージを貯める配列,カードID,タイプ、受信時刻

        this.status({fill:"green",shape:"ring",text:"waiting"});
        nfc.on('touchstart', (card) => {
            try{
                this.status({fill:"green",shape:"dot",text:"touched:"+(cardArray.length+1)});
                if(startTime == false && cardArray.length == 0){
                    startTime = Date.now();
                    timer_of_send(node);
                }
                setTimeout(() =>{
                    nfc.start();
                    this.status({fill:"green",shape:"ring",text:"waiting"});
                },node.waitTime);

                var msg = {
                    'payload'   : card.id,
                    'type'      : card.type,
                    'timestamp' : Date.now()
                };
                cardArray.push(msg);
            }catch(err){
                node.error("touchstartイベントでエラーが発生しました");
                restart_nfc(nfc);
            }
        });

        nfc.on('error', (err) => {
            // standard error output (color is red)
            console.error('\u001b[31m', err, '\u001b[0m');
            node.error("カード取得全体でエラーが発生しました");
        });

        node.on('close',function(){
            nfc.pause();
        });

        function timer_of_send(){   // 10秒タイマー + メッセージ送信

            var newMsg = {                  // 新規に送信するメッセージ
                "payload"     : {
                    "objectType"        : "iaCloudObject",
                    "objectKey"         : "12345" ,
                    "objectDescription" : "node-red-contrib-ia-cloud-nfcpy-id" ,
                    "timestamp"         : Date.now(),
                    "instanceKey"       : "string",
                    "objectContent"     : [] }
            };
            try{
                setTimeout(() => {
                    for(var k in cardArray){
                        if(k == 0 || (k > 0 && cardArray[k].payload != cardArray[k-1].payload)){
                            newMsg.payload.objectContent.push({
                                "dataName"    : "NfcData",
                                "commonName"  : "node-red-contrib-ia-cloud-nfcpy-id" ,
                                "dataValue"   : cardArray[k].payload,
                                'type'        : cardArray[k].type,
                                'timestamp'   : cardArray[k].timestamp }); 
                        }
                    }
                    startTime   = false;
                    cardArray   = [];
                    node.send(newMsg);
                }, node.sendTime);
            }catch(err){
                node.error("タイマーでエラーが発生しました");
                restart_nfc();
            }
        }
        function restart_nfc(nfc){
            try{
                nfc.pause();
                nfc.start();
            }catch(err){
            }
        }
    }
    RED.nodes.registerType("ia-cloud-nfcpy",nfcpyidNode);

}