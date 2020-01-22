import { StmtGen } from "../StmtGen"
import { Type, Describe } from "../shapes/coreShapes"
import { IDS } from "../constants"


let t1 = new Type()
t1.string = null

const describeDomain = new Describe()
describeDomain[Symbol.for('Shape.setKeys')]({
    metaShape: null,
    payloadShape: t1,
    retractable:true,
    directAssertion:false,
    hashTags:[-1,0],//no indexing
    mentions:[-1,0],//cannot mention anyone
    contexts:[-1,0],//cannot point it at another stmt
    intent: 'Should be the exact IP/URL with port number and location of server (default: /monarch). '+
    'Payload string should need no manipulation in order to properly connect to a monarach client.',
    minWork:24 //lots of work, want to make sure the server is contributing positively to the network.
    //If this is a router on a non-static IP, hopefully the IP doesn't change often.
})
export const DomainStmt = StmtGen(IDS.domainStmt,describeDomain)
