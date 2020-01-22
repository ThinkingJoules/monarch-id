import {encode,decode} from './util'
import { TRUEHASH, FALSEHASH } from './constants';

export default function Aegis(webcrypto,secp256k1){
    const aegis = this
    aegis.subtle = (webcrypto.subtle || webcrypto.webkitSubtle)
    aegis.settings = {};

    aegis.settings.pbkdf2 = {hash: 'SHA-256', iter: 100000, ks: 64};
    aegis.settings.ecdsa = {
        pair: {name: 'ECDSA', namedCurve: 'P-256'},
        sign: {name: 'ECDSA', hash: {name: 'SHA-256'}}
    };
    aegis.settings.ecdh = {name: 'ECDH', namedCurve: 'P-256'};

    aegis.random = (len) => {
        let r = webcrypto.getRandomValues?webcrypto.getRandomValues(new Uint8Array(len)):webcrypto.getRandomBytes(new Uint8Array(len))
        return Buffer.from(r.buffer,r.byteOffset,r.length)
    }
    aegis.pair = async function(){
        return await aegis.subtle.generateKey(aegis.settings.ecdsa.pair, true, [ 'sign', 'verify' ])
        .then(async (keys) => {
            let k = {}
            k.priv = Buffer.from(await aegis.subtle.exportKey('pkcs8', keys.privateKey))
            k.pub = Buffer.from(await aegis.subtle.exportKey('raw', keys.publicKey))
            return k 
        })    
    }

    aegis.hash = async function(jsValue,fullHash=false){
        let byteArray
        if(jsValue instanceof Uint8Array)byteArray = jsValue
        else if(jsValue === true)return TRUEHASH
        else if(jsValue === false)return FALSEHASH
        else byteArray = encode(jsValue,false,true)
        return fullHash? Buffer.from(await aegis.subtle.digest({name:'SHA-256'},byteArray)) : Buffer.from(await aegis.subtle.digest({name:'SHA-256'},byteArray)).slice(0,18)
    }
    aegis.aes = async function(key,salt){//??? Not sure... 
        const combo = Buffer.concat([Buffer.from(key),((salt && Buffer.from(salt)) || aegis.random(8))])
        const hash = await aegis.subtle.digest({name:'SHA-256'},combo)
        return await aegis.subtle.importKey('raw', new Uint8Array(hash), 'AES-GCM', false, ['encrypt', 'decrypt'])
    }
    aegis.importSignKey = async function(keyBits){
        return await aegis.subtle.importKey('pkcs8',keyBits,aegis.settings.ecdsa.pair,false,['sign'])
    }
    aegis.extend = async function(jsThing,entropy,opt){
        //entropy is string, but could be a buffer already
        //jsThing can be string (password), but could also be object, array, etc, as it will be encoded in bits
        //this returns bits for a key
        opt = opt || {};
        let salt = entropy || opt.salt
        salt = (salt && Buffer.from(salt)) || aegis.random(16)
        let srcBits = (jsThing instanceof Buffer || jsThing instanceof Uint8Array) ? jsThing : encode(jsThing,false,true)
        let keyBits = await aegis.subtle.importKey('raw', srcBits, {name:'PBKDF2'}, false, ['deriveBits'])
        .then(async(key) =>{
            console.log(key)
            return Buffer.from(await aegis.subtle.deriveBits({
                name: 'PBKDF2',
                iterations: opt.iterations || 750000,
                salt: Buffer.from(salt),
                hash: {name: 'SHA-256'},
              }, key, 256))
        })
        return keyBits
    }
    aegis.encrypt = async function(payload,keyBits,cb){
        let u
        if(u === payload){ console.warn('`undefined` not allowed. VALUE CHANGED TO `null`!!!') }
        let encPayload = encode(payload,false,true)
        let iv = aegis.random(12)
        let ct = await aegis.subtle.importKey('raw', keyBits, 'AES-GCM', false, ['encrypt'])
        .then((aes) => aegis.subtle.encrypt(
            { name: 'AES-GCM', iv}, aes, encPayload)
        );
        let r = {
          ct:Buffer.from(ct),
          iv,
        }
        if(cb && cb instanceof Function)cb(r)
        return r
    }
    aegis.decrypt = async function(encObj,keyBits,cb){
        let {ct,iv} = encObj
        let pt =  await aegis.subtle.importKey('raw', keyBits, 'AES-GCM', false, ['decrypt'])
        .then((aes) => aegis.subtle.decrypt({ name: 'AES-GCM', iv}, aes, ct));
        let plainJs = decode(pt)
        if(cb && cb instanceof Function)cb(plainJs)
        return plainJs
    }
    
    aegis.extendEncrypt = async function(jsTarget,passphrase){
        let s = aegis.random(16)
        let encObj = await aegis.extend(passphrase,s)
        .then(async(keyBits) =>{
            return await aegis.encrypt(jsTarget,keyBits)
        })
        encObj.s = s
        return encObj

    }
    aegis.extendDecrypt = async function(encObj,passphrase){
        let s = encObj.s
        let jsThing = await aegis.extend(passphrase,s)
        .then(async(keyBits) =>{
            return await aegis.decrypt(encObj,keyBits)
        })
        return jsThing
    }
    
    aegis.verify = async function(pub,sig,jsData,cb){//sig must be buffer or base64
        let data = (jsData instanceof Buffer || jsData instanceof Uint8Array)?jsData:encode(jsData,{sortKeys:true})
        if(typeof sig === 'string')sig = Buffer.from(sig,'base64')
        let passed = await aegis.subtle.importKey('raw',pub,aegis.settings.ecdsa.pair,false,['verify'])
        .then((cKey)=> aegis.subtle.verify(aegis.settings.ecdsa.sign,cKey,sig,data))
        if(cb && cb instanceof Function) cb(passed)
        return passed
    }  
}




function str2ab(str) {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
}