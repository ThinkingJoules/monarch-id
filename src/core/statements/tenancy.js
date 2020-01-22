import { StmtGen } from "../StmtGen"
import { Describe } from "../shapes/coreShapes"
import { IDS } from "../constants"



const describeTenancy = new Describe()
describeTenancy[Symbol.for('Shape.setKeys')]({
    metaShape: null,
    payloadShape: null,
    retractable:false,
    directAssertion:true, //requires an ack to be 'active' or 'denied'
    hashTags:[-1,0],//no indexing
    mentions:[1,1],//must mention exactly one identity that will store your application data.
    contexts:[-1,0],//cannot point it at another stmt
    intent: 'This is intended for identities that do not have their own server ("easement" or "domain"). '+
    'The scope of the tenancy agreement is handled outside of the protocol. '+
    'The intent is that you know and trust someone to hold your data. '+
    'Whoever is storing the data will be able to see (unless encrypted) and delete/invalidate (data should still be signed).'
})
export const TenancyStmt = StmtGen(IDS.tenancyStmt,describeTenancy)