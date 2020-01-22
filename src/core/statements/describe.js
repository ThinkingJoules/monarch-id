import { StmtGen } from "../StmtGen"
import { Type, Describe } from "../shapes/coreShapes"
import { IDS } from "../constants"



let t = new Type()
t.shape = IDS.describeShape

const describeDescribe = new Describe()
describeDescribe[Symbol.for('Shape.setKeys')]({
    metaShape:null,
    payloadShape:t,
    retractable:false,
    directAssertion:false,
    mentions:[-1,0],//cannot mention anyone
    contexts:[-1,0],//cannot point it at another stmt
    intent: 'Use to generate new statement types that the entire network can interpret.',
    minWork:20
})
export const DescribeStmt = StmtGen(IDS.describeStmt,describeDescribe)

