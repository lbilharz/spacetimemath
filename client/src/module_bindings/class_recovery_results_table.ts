// Hand-written binding for private table class_recovery_results (ACCT-04).
// codegen skips private tables — follow recovery_code_results_table.ts pattern.
/* eslint-disable */
/* tslint:disable */
import {
  TypeBuilder as __TypeBuilder,
  t as __t,
  type AlgebraicTypeType as __AlgebraicTypeType,
  type Infer as __Infer,
} from "spacetimedb";

export default __t.row({
  memberIdentity: __t.identity().primaryKey(),
  teacherIdentity: __t.identity(),
  classroomId: __t.u64(),
  username: __t.string(),
  code: __t.string(),
});
