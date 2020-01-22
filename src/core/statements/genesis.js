import { StmtGen } from "../StmtGen"
import { Type, Describe } from "../shapes/coreShapes"
import { IDS } from "../constants"

let t0 = new Type()
t0.binary = [16,16]
let t1 = new Type()
t1.shape = IDS.shieldSignetShape

const describeGenesis = new Describe()
describeGenesis[Symbol.for('Shape.setKeys')]({
    metaShape: t0,//original proof that the MID was derived from
    payloadShape: t1,
    relaxPayloadShape:'pure',
    retractable:true,
    directAssertion:false,
    hashTags:[0,1],//allow a single index for payload retrieval for remote login
    mentions:[-1,0],//cannot mention anyone
    contexts:[-1,0],//cannot point it at another stmt
    intent: 'Used to start a new identity chain.',
    minWork:15
})
export const GenesisStmt = StmtGen(IDS.genesisStmt,describeGenesis)
