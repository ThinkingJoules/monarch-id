import { buildStateMachine, StateMachineKey } from "./stateBuilder"



function BasePerson(){//can only run constructor one time
    //can only be created 3 ways:
    //1- We hear a stmt with this cid, but we don't already know of them
    //2- We hear a stmt with them referenced
    //3- we are restoring state from disk
    //the logic is the same either way, except that restore has more state to add
    //we create the person, and basically just wait for stmts to come in
    let they = this

    they.id = BitID(cid)
    let check = gossip.people.get(they.id)
    if(check)return check
    they.proof = null //genesis block, to prove their cid is random
    they.say = [] //only added to from saidStmt, set of stmt objects
    they.
    they.pend = []
    they.merkleRoot = null
    they.tail = null //altered from adding by saidStmt, should be the prevSig of the last valid block on the chain
    they.peers = new Set() //altered from adding by saidStm
    they.pubs = new Map() //altered from adding by saidStm, key of BitID(uintToBuff(stmt.pub)), value of Pub bytes
    they.online = new Set() //set of online peers that have verified they have signing keys for this identity
    they.maxWork = 0
    they.cummWork = 0
    they.verified = false //on them answering our identity challenge
    they.pin = restore[0] || false //set from a 'follow' api call, will not prune regardless of dist
    let where = (root.peer.isPeer && root.peer.id) || root.state.anchor
    they.dist = restore[1] || (they.id && where) ? root.monarch.distance(where,they.id) : Infinity
    they.add = new EventEmitter()
    they.add.on('verifiedStmt',function(stmt){

    })
    they.add.once('genesis',function(){

    })
    they.add.on('addKey',function(stmt){
        let num = Math.max(...they.pubs.keys()) + 1
        they.pubs.set(num,[stmt.ts,stmt.body])
    })
    they.addStmt = async function(stmt){
        if(they.say.includes(stmt) || they.pend.includes(stmt))return
        they.pend.push(stmt)
        they.pend.sort((a,b) =>a.ts-b.ts)
        if(!they.inloop)they.checkStmts()
    }
    they.checkStmts = async function(){
        let added = []
        try {
            they.inloop = true
            while (true) {
                if(!they.pend.length)break
                let mr = they.merkleRoot || nullHash
                let nextStmt = they.pend[0]
                if(!await nextStmt.verify(mr))break
                if(nextStmt.st === 0){// this is a retraction, should pair it next to the reference
                    let match = they.leaves.findIndex((el)=>Buffer.compare(el.rootHash,nextStmt.body)===0)
                    if(match === -1){//either tree is invalid, or the stmt is invalid
                        throw new Error('Invalid Stmt, retraction does not match any statements')
                    }
                    they.leaves[match+1]=nextStmt
                }else{
                    they.leaves = they.leaves.concat([nextStmt,gossip.nullStmt])
                }
                added.push(nextStmt)
                they.tail = they.pend.shift()
                //when it is added we need to emit some sort of event
                //so that either when we received and confirmed or made and confirmed, we can decide whether to rebroadcast/towho, etc
            }
        } catch (error) {
            root.opt.debug('Could not add Stmt to merkle tree:',error)
        }
        if(added.length)they.buildTree()
        they.inloop = false
        return added
    }
    they.memoHash = MemoStore(
        async function(h1,h2){
            return await root.aegis.hash(Buffer.concat([h1,h2]))
        },
        function(h1,h2){
            return h1.toString('binary')+h2.toString('binary')
        },
        function(h1,h2){
            if(!(h1 instanceof Buffer && h2 instanceof Buffer))throw new Error('must pass two buffers')
        },true)
    they.buildTree = async function(){
        const nodes = they.leaves.map((x)=>x.rootHash)
        they.tree = [nodes]
        while (nodes.length > 1) {
            var layerIndex = they.tree.length;
            they.tree.push([]);
            for (var i = 0; i < nodes.length; i += 2) {
                var left = nodes[i];
                var right = i + 1 == nodes.length ? left : nodes[i + 1];
                var hash = they.memoHash(left,right)
                they.tree[layerIndex].push(hash);
            }
            nodes = they.tree[layerIndex];
        }
    }
}
const numTest = (val)=>{if(typeof val !== 'number')throw new Error('Must supply a number for which pubkey was used to sign')}
const proofTest = (val)=>{if(!val.MBuffer || val.type !== 'PROOF')throw new Error('Must supply a PROOF')}
const shapeTest = (val)=>{if(!val.shape)throw new Error('Must be a "Shape" that is packed (array).')}
const bufferTest = (type)=>(val)=>{if(!val.MBuffer || val.type !== type)throw new Error(`Must supply a ${type}`)}
export const Person = buildStateMachine([
    StateMachineKey('id',true,bufferTest('MID')),//don't need to pack, as filename/key will be the id

])
