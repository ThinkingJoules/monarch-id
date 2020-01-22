import {buildStateMachine,StateMachineKey} from "./stateBuilder";
import { Enum, uintToBuff } from "./util";
import MBuffer from "./impl/mbuffer";
import {monarch} from './client'

function BaseStmt(root){
    //how to handle root if I do prototype approach...
}
BaseStmt.prototype.addPow = async function(work){//used when making a stmt
    const s = this
    work = work || 14
    if(!(s.cid && s.smh && s.pmh && s.ph && s.ts))throw new Error('Must hash the payload and provide a ts, as these are both included in the proof')
    let pt = Buffer.concat([s.cid,s.ts,s.smh,s.pmh,s.ph])//must do more than the hash, to ensure work can't be reused for st 2&4
    return (s.proof = await monarch.pow(pt,{isHash:true,target:work}))
}
const numTest = (val)=>{if(typeof val !== 'number')throw new Error('Must supply a number for which pubkey was used to sign')}
const proofTest = (val)=>{if(!val.MBuffer || val.type !== 'PROOF')throw new Error('Must supply a PROOF')}
const shapeTest = (val)=>{if(!val.shape)throw new Error('Must be a "Shape" that is packed (array).')}
const bufferTest = (type)=>(val)=>{if(!val.MBuffer || val.type !== type)throw new Error(`Must supply a ${type}`)}
function genHash(type){
    return async function(){
        if(type === 'ROOTHASH')return await monarch.hash(type,[...arguments])
        return await monarch.hash(type,...arguments)
    }
}
export const Stmt = buildStateMachine([
    StateMachineKey('cid',true,bufferTest('MID'),3),
    StateMachineKey('person',true,false,false),
    StateMachineKey('prevSig',true,bufferTest('SIG'),2),
    StateMachineKey('ts',true,bufferTest('TS'),4,['tsUnix'],(val)=>{return MBuffer('TS',uintToBuff(val,6))}),
    StateMachineKey('st',true,bufferTest('STMTID'),5),
    StateMachineKey('pub',true,numTest,6),
    StateMachineKey('proof',true,proofTest,0),
    StateMachineKey('sMeta',true,shapeTest,10),
    StateMachineKey('pMeta',true,shapeTest,11),
    StateMachineKey('payload',true,shapeTest,12),
    StateMachineKey('pubKey',true,bufferTest('PUB'),13),
    StateMachineKey('prevStmt',true,bufferTest('TS'),14),
    StateMachineKey('tsUnix',true,numTest),
    StateMachineKey('id',false,false,false,['cid','ts'],(cid,ts)=>{return MBuffer('STMTID',Buffer.concat([cid.raw,ts.raw]))}),
    StateMachineKey('smh',true,bufferTest('SMETAHASH'),7,['sMeta'],genHash('SMETAHASH'),true),
    StateMachineKey('pmh',true,bufferTest('PMETAHASH'),8,['pMeta'],genHash('PMETAHASH'),true),
    StateMachineKey('ph',true,bufferTest('PAYLOADHASH'),9,['payload'],genHash('PAYLOADHASH'),true),
    StateMachineKey('diffHit',false,false,false,['proof','cid','ts','smh','pmh','ph'],monarch.checkStmtWork,true),
    StateMachineKey('work',false,false,false,['diffHit'],monarch.calcGuesses),
    StateMachineKey('verified',false,false,false,['person','diffHit','pubKey','prevStmt','prevSig'],()=>{return true})
],BaseStmt)