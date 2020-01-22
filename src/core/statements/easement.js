import { StmtGen } from "../StmtGen"
import { Describe } from "../shapes/coreShapes"
import { IDS } from "../constants"



const describeEasement = new Describe()
describeEasement[Symbol.for('Shape.setKeys')]({
    metaShape: null,
    payloadShape: null,
    retractable:false,
    directAssertion:true, //requires an ack to be 'active' or 'denied'
    hashTags:[-1,0],//no indexing
    mentions:[1,1],//must mention exactly one identity that will forward msgs to this server
    contexts:[-1,0],//cannot point it at another stmt
    intent: 'This is intended for a server behind NAT. This will peer through the peers listed on the mentioned Identity chain.'+
    'The mentioned identity will forward all requests they receive straight through to this identity/server. '+
    'Really only "valid" if the mentioned identity has "Domain" stmt(s) on their chain. '+
    'Would be used in place of a "Domain" stmt and probably in conjunction with a "Fealty" stmt.'
})
export const EasementStmt = StmtGen(IDS.easeStmt,describeEasement)