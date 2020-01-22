import { getBaseLog, encode, decode,BitID, buffToUint, uintToBuff, hammingWt, outputHeaderedStr, parseHeaderedStr } from './util';
import MBuffer from './impl/mbuffer';


export default function Monarch(aegis){
    //this will be the inbetween of the crypto and outer APIs
    //this is where identity things will happen
    //anything to do with the user chain, authorizing the snap instance
    //such as adding to the curr
    const monarch = this
    monarch.nullHash = (async function(){
        return Buffer.from(await aegis.hash(encode(null)))
    })()
    
    monarch.create = async function(credPass,cb,opt){
        opt = opt || {}
        cb = (cb instanceof Function && cb) || function(){}
        let proofTarget = opt.proof || 16 //15 or 16 is network default threshold to create new identity?
        const pair = await aegis.pair()
        root.user.sign = await sign(pair.priv)
        let body = pair.pub
        let hash = await aegis.hash(body)
        let {ct,iv:proof} = await monarch.pow(hash,{target:proofTarget,all:true,isHash:true})
        let cid = BitID(ct.slice(0,32))
        let stmt = new monarch.Stmt({hash,proof,cid,st:0,pub:0,body})
        await stmt.addPow(16)
        await stmt.sign()
        let authCreds = [cid.buffer,pair.priv,0]
        if(credPass){
            authCreds = await aegis.extendEncrypt(authCreds,credPass)
        }
        authCreds = outputHeaderedStr(authCreds,(credPass)?'ENCRYPTED AUTH':'AUTH')
        console.log(stmt)
        if(!await monarch.auth({passphrase:credPass,creds:authCreds,tail:sig}))throw new Error('Auth Failed')
        root.router.send.say(stmt.transform())//TODO
        return authCreds
    }
    monarch.verifyCID = async function(cid,proof,pub){//genesis block
        let {ct,chance,diffHit} = await root.monarch.checkPow(pub,proof,{all:true})
        let cidcheck = ct.slice(1,18)
        return (!Buffer.compare(cid.raw,cidcheck))?{diffHit,chance}:0//should be 0 if a match (!0 = true), else -1/1 (!1 = false)
    }
    monarch.hash = async function(type,plainJS){
        if(!['SMETAHASH','PMETAHASH','PAYLOADHASH','HASHTAG','TREEHASH','ROOTHASH'].includes(type)){
            throw new Error('Must Specify which type of hash the result will be!')
        }
        if(['SMETAHASH','PMETAHASH','PAYLOADHASH'].includes(type) && !plainJS.shape){
            throw new Error('Must provide a "Shape" object (array) to hash.')
        }
        if(type === 'HASHTAG' && typeof plainJS !== 'string')throw new Error('Must provide a string to generate a HASHTAG')
        if(['TREEHASH','ROOTHASH'].includes(type)){
            if(!Array.isArray(plainJS) || !plainJS.every((x)=>{return !!x.MBuffer}))throw new Error('Must supply an array of buffers to concat and hash')
            return MBuffer(type,await aegis.hash(Buffer.concat(plainJS)))
        }
        return MBuffer(type,await aegis.hash(encode(plainJS)))

    }
    monarch.auth = async function(auth,cb){
        const {passphrase,creds,authNameString} = auth || {}
        let authd
        if(creds){
            let buffContent
            if(typeof creds === 'string'){
                let {content} = parseHeaderedStr(creds)
                buffContent = decode(Buffer.from(content,'base64'))
            }else if(creds instanceof Buffer)buffContent = decode(creds)
            attemptAuth(buffContent)
        }else{
            let key = Buffer.from(await aegis.hash(encode(authNameString)))
            root.router.send.getAliasHash(key,async function(resp){
                //should be an array of statements that are unique, but match this hash
                //since we don't know our CID, we need to try and auth each one that is the correct statement type
                for (const [header,body] of resp) {
                    let stmt = new monarch.Stmt({header,body})
                    if(stmt.st !== 2)continue
                    if(await authCreds(body)){
                        if(cb && cb instanceof Function)cb(false,true)
                        return
                    }
                }
                if(cb && cb instanceof Function)cb(new Error('Could not auth with any of the statements received'))
            })
        }
        async function attemptAuth(authCreds){
            try {
                let content
                if(passphrase)content = await dec(authCreds)
                else content = authCreds
                return await authSnap(content)
            } catch (error) {
                return false
            }
        }
        async function dec(content){
            if(!passphrase)throw new Error('Must provide a passphrase to decrypt the login')
            return await aegis.extendDecrypt(content,passphrase)
        }
        async function authSnap(content){
            let [cid,priv,pub] = content
            root.user = new root.gossip.Us(cid,pub)
            root.user.sign = await sign(priv)
            root.opt.log('Successfully Authd')
            root.event.emit('auth',true)
            return true
        }
    }

    
    const powKey = Buffer.from([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16])//whole network knows this key, all work is generated/checked with it
    monarch.pow = async function(jsTarget,opt){
        let s = Date.now()
        if(jsTarget === undefined)throw new Error("Must specify something to prove work was performed on")
        opt = opt || {}
        let {updateCB,contUpdateCB,target,all,updateEvery,isHash} = opt
        updateEvery = updateEvery || 5000
        if(!(jsTarget instanceof Buffer || jsTarget instanceof Uint8Array))jsTarget=encode(jsTarget,false,true)
        let hash = isHash ? jsTarget : await aegis.hash(jsTarget)
        let cKey = await aegis.subtle.importKey('raw', powKey, 'AES-CBC', false, ['encrypt'])
        let ct,iv,rounds = 0
        let trgt = target || 16
        ,first = Math.floor(trgt/8)
        ,last = calcLast(trgt%8)
        ,chance = calcChance(trgt)
        ,avgGuesses = 1/chance
        ,r50 = guessesForP(.5,chance),r80 = guessesForP(.8,chance),r95 = guessesForP(.95,chance),r99 = guessesForP(.99,chance)
        ,rate,cur = {chance:.5,time:null}
        while (true) {
            rounds++
            iv = aegis.random(16)//TODO try with an incrementing iv instead of random
            ct = Buffer.from(await aegis.subtle.encrypt({ name: 'AES-CBC', iv}, cKey, hash))
            if(compare(ct,trgt)){
                break
            }
            if(rounds === 5000){rate = (Date.now()-s)/rounds;update(.5)}
            if(!rounds%20000){rate = (Date.now()-s)/rounds}
            if(contUpdateCB && contUpdateCB instanceof Function && !(rounds%updateEvery)){
                cur.time = Math.round(howLong(cur.chance)/1000)
                contUpdateCB.call(contUpdateCB,cur)
            }
            if(rate && rounds === r50)update(.8)
            if(rate && rounds === r80)update(.95)
            if(rate && rounds === r95)update(.99)
            if(rate && rounds === r99)update(.999)
        }
        let fin = Date.now()-s
        let proof = {
            ct,
            iv,
        }
        root.opt.debug({proof},{fin,rounds,per:fin/rounds})
        if(all)return proof
        return iv
        function update(curP){
            cur.chance = curP
            cur.time = Math.round(howLong(cur.chance)/1000)
            if(updateCB && updateCB instanceof Function)updateCB.call(updateCB,cur)
            root.opt.debug(`${cur.chance*100}% chance to be done in another: ${cur.time} seconds`)
        }
        function howLong(p){
            let tot = guessesForP(p,chance)
            let toGo = tot-rounds
            return Math.round(toGo*rate)
        }
        function compare (ct) {//checks the last cbc block (last 16 bytes)
            let i = ct.length-16
            for (let b=first+i; i < b; i++) {
              if(ct[i] !== 0){return false}
            }
            return last.includes(ct[i])
        }
    }
    monarch.checkPow = async function(pt,iv,opt){
        opt = opt || {}
        if(!(pt instanceof Buffer || pt instanceof Uint8Array))pt=encode(pt,false,true)
        let hash = opt.isHash?pt:await aegis.hash(pt)
        let cKey = await aegis.subtle.importKey('raw', powKey, 'AES-CBC', false, ['encrypt'])
        let ct = Buffer.from(await aegis.subtle.encrypt({ name: 'AES-CBC', iv}, cKey, hash))

        let diffHit = 0,i = ct.length-16
        for (; i < ct.length; i++) {
            const element = ct[i];
            diffHit+=getZeros(element)
            if(element !=0)break
        }
        let chance = calcChance(diffHit)
        //root.opt.debug({diffHit,avgGuesses:1/chance})
        if(opt.all)return {diffHit,ct,chance,hash}
        return diffHit
        function getZeros(regValue){
            if(regValue==0)return 8
            if(regValue>127)return 0
            if(regValue>63)return 1
            if(regValue>31)return 2
            if(regValue>15)return 3
            if(regValue>7)return 4
            if(regValue>3)return 5
            if(regValue>1)return 6
            if(regValue==1)return 7
        }
    }
    monarch.checkStmtWork = async function(proof,cid,ts,smh,pmh,ph){
        if(!(cid.MBuffer && ts.MBuffer && smh.MBuffer && pmh.MBuffer && ph.MBuffer && proof.MBuffer))throw new Error('Must provide keyed buffers (MBuffer)')
        return await monarch.checkPow(Buffer.concat([cid,ts,smh,pmh,ph],43),proof,{isHash :true})
    }

    monarch.verifyStmt = async function(thisSig,prevSig,cid,ts,st,rh,pubKey){
        if(!(cid.MBuffer 
            && ts.MBuffer 
            && rh.MBuffer 
            && prevSig.MBuffer 
            && thisSig.MBuffer 
            && pubKey.MBuffer)
        )throw new Error('Must provide keyed buffers (MBuffer)')
        try {
            if(await aegis.verify(pubKey.raw,thisSig.raw,Buffer.concat([prevSig.raw,cid,ts,st,rh]))){
                return true
            }else{
                throw new Error('Signature invalid')
            }
        } catch (error) {
            console.warn('Stmt not verified: ',error)
            return false
        }
        
    }
    monarch.calcChance = calcChance
    monarch.calcGuesses = (chance) =>{return 1/chance}
    function guessesForP(p,chance){
        //https://math.stackexchange.com/a/1119890
        let d = getBaseLog(1/(1-p),1-chance)
        return Math.round((-1/d)+1)
    }
    function calcChance(diff){
        let a = Math.floor(diff/8)
        return (a-1+(calcLast(diff%8,1)))/Math.pow(256,a+1)
    }
    function calcLast(diffModulo,num){
        let l
        switch (diffModulo) {
            case 0: l=256;break;
            case 1: l=128;break;
            case 2: l=64;break;
            case 3: l=32;break;
            case 4: l=16;break;
            case 5: l=8;break;
            case 6: l=4;break;
            case 7: l=2;break;
        }
        return (num) ? l : Array.from({length:l},(a,i)=>i)
    }
    
    async function sign(keyBits){
        let cKey = await aegis.importSignKey(keyBits)
        let algo = aegis.settings.ecdsa.sign
        return async function(data,cb,opt){
            opt = opt || {}
            let buff = (data instanceof Buffer || data instanceof Uint8Array || data instanceof ArrayBuffer)?data:encode(data,false,true);
            const sig = await aegis.subtle.sign(algo,cKey,buff)
            let output = opt.string?Buffer.from(sig).toString('base64'):Buffer.from(sig)
            if(cb && cb instanceof Function) cb(output)
            return output
        }
    }
    
    
}