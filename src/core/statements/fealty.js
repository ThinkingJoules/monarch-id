import { StmtGen } from "../StmtGen"
import { Describe } from "../shapes/coreShapes"
import { IDS } from "../constants"



const describeFealty = new Describe()
describeFealty[Symbol.for('Shape.setKeys')]({
    metaShape: null,
    payloadShape: null,
    retractable:false,
    directAssertion:true, //requires an ack to be 'active' or 'denied'
    hashTags:[-1,0],//no indexing
    mentions:[1,1],//must mention exactly one identity that will own this identity if this stmt is ack+
    contexts:[-1,0],//cannot point it at another stmt
    intent: 'This is intended for a remote server to be owned by your "main" identity. '+
    'This identity will become "owned" by the identity in the mention (once they ack+ this stmt). '+
    'This is not reversible since this identity is merely a remote surrogate for the main identity.'+
    'Would probably be used in conjunction with a "Domain" stmt.'
})
export const FealtyStmt = StmtGen(IDS.fealtyStmt,describeFealty)