use spacetimedb::ViewContext;
use crate::*;

/// =========================================
/// PLAYER VIEWS
/// Explicitly scoped to the caller's Identity
/// =========================================

#[spacetimedb::view(accessor = my_sessions, public)]
pub fn my_sessions(ctx: &ViewContext) -> Vec<Session> {
    let sender = ctx.sender();
    ctx.db.sessions().player_identity().filter(&sender).collect()
}

#[spacetimedb::view(accessor = my_answers, public)]
pub fn my_answers(ctx: &ViewContext) -> Vec<Answer> {
    let sender = ctx.sender();
    ctx.db.answers().player_identity().filter(&sender).collect()
}

#[spacetimedb::view(accessor = my_student_keystrokes, public)]
pub fn my_student_keystrokes(ctx: &ViewContext) -> Vec<StudentKeystroke> {
    ctx.db.student_keystrokes().student_id().find(ctx.sender()).into_iter().collect()
}

#[spacetimedb::view(accessor = my_email_results, public)]
pub fn my_email_results(ctx: &ViewContext) -> Vec<MyEmailResult> {
    ctx.db.email_results().owner().find(ctx.sender()).into_iter().collect()
}

#[spacetimedb::view(accessor = my_teacher_focus, public)]
pub fn my_teacher_focus(ctx: &ViewContext) -> Vec<TeacherFocus> {
    let mut results = Vec::new();
    let sender = ctx.sender();
    if let Some(tf) = ctx.db.teacher_focus().teacher_id().find(sender) {
        results.push(tf);
    }
    results.extend(ctx.db.teacher_focus().focused_student_id().filter(&sender));
    // Remove duplicates if the teacher somehow focused themselves
    results.dedup_by_key(|tf| tf.teacher_id);
    results
}

#[spacetimedb::view(accessor = my_recovery_code_results, public)]
pub fn my_recovery_code_results(ctx: &ViewContext) -> Vec<RecoveryCodeResult> {
    ctx.db.recovery_code_results().owner().find(ctx.sender()).into_iter().collect()
}

#[spacetimedb::view(accessor = my_restore_results, public)]
pub fn my_restore_results(ctx: &ViewContext) -> Vec<RestoreResult> {
    ctx.db.restore_results().caller().find(ctx.sender()).into_iter().collect()
}


#[spacetimedb::view(accessor = my_issued_problem_results_v2, public)]
pub fn my_issued_problem_results_v2(ctx: &ViewContext) -> Vec<IssuedProblemResultV2> {
    ctx.db.issued_problem_results_v2().owner().find(ctx.sender()).into_iter().collect()
}


#[spacetimedb::view(accessor = my_next_problem_results_v2, public)]
pub fn my_next_problem_results_v2(ctx: &ViewContext) -> Vec<NextProblemResultV2> {
    ctx.db.next_problem_results_v2().owner().find(ctx.sender()).into_iter().collect()
}

#[spacetimedb::view(accessor = my_unlock_logs, public)]
pub fn my_unlock_logs(ctx: &ViewContext) -> Vec<UnlockLog> {
    let sender = ctx.sender();
    ctx.db.unlock_logs().player_identity().filter(&sender).collect()
}

#[spacetimedb::view(accessor = my_player_dkt_weights, public)]
pub fn my_player_dkt_weights(ctx: &ViewContext) -> Vec<PlayerDktWeights> {
    ctx.db.player_dkt_weights().player_identity().find(ctx.sender()).into_iter().collect()
}

#[spacetimedb::view(accessor = my_class_recovery_results, public)]
pub fn my_class_recovery_results(ctx: &ViewContext) -> Vec<ClassRecoveryResult> {
    let sender = ctx.sender();
    ctx.db.class_recovery_results().teacher_identity().filter(&sender).collect()
}

/// =========================================
/// SOCIAL & CLASSROOM VIEWS
/// Scoped to caller's classrooms and friendships
/// =========================================

#[spacetimedb::view(accessor = my_classrooms, public)]
pub fn my_classrooms(ctx: &ViewContext) -> Vec<Classroom> {
    let sender = ctx.sender();
    // Classrooms I teach
    let mut result: Vec<Classroom> = ctx.db.classrooms().teacher().filter(&sender).collect();
    // Classrooms I'm a member of
    for membership in ctx.db.classroom_members().player_identity().filter(&sender) {
        if let Some(classroom) = ctx.db.classrooms().id().find(membership.classroom_id) {
            result.push(classroom);
        }
    }
    result.sort_by_key(|c| c.id);
    result.dedup_by_key(|c| c.id);
    result
}

#[spacetimedb::view(accessor = my_classroom_members, public)]
pub fn my_classroom_members(ctx: &ViewContext) -> Vec<ClassroomMember> {
    let sender = ctx.sender();
    // Collect all classroom IDs I'm involved in
    let mut my_classroom_ids: Vec<u64> = ctx.db.classrooms().teacher().filter(&sender)
        .map(|c| c.id).collect();
    for m in ctx.db.classroom_members().player_identity().filter(&sender) {
        my_classroom_ids.push(m.classroom_id);
    }
    my_classroom_ids.sort();
    my_classroom_ids.dedup();
    // Return all members of those classrooms
    let mut result = Vec::new();
    for cid in my_classroom_ids {
        result.extend(ctx.db.classroom_members().classroom_id().filter(&cid));
    }
    result
}

#[spacetimedb::view(accessor = my_friendships, public)]
pub fn my_friendships(ctx: &ViewContext) -> Vec<Friendship> {
    let sender = ctx.sender();
    let mut result: Vec<Friendship> = ctx.db.friendships().initiator_identity().filter(&sender).collect();
    result.extend(ctx.db.friendships().recipient_identity().filter(&sender));
    result.sort_by_key(|f| f.id);
    result.dedup_by_key(|f| f.id);
    result
}

#[spacetimedb::view(accessor = my_friend_invites, public)]
pub fn my_friend_invites(ctx: &ViewContext) -> Vec<FriendInvite> {
    ctx.db.friend_invites().creator_identity().filter(&ctx.sender()).collect()
}

/// =========================================
/// TEACHER DASHBOARD VIEWS
/// 3-hop joins resolving: Teacher -> ClassSprint -> Session -> Data
/// =========================================

#[spacetimedb::view(accessor = my_classroom_sessions, public)]
pub fn my_classroom_sessions(ctx: &ViewContext) -> Vec<Session> {
    let mut visible_sessions = Vec::new();
    let sender = ctx.sender();
    
    // 1. Authorization: ALL sprints where the caller is the TEACHER (active and historical)
    // Security Acceptance Note: Exposing full historical sprint data to the teacher 
    // is an intentional, accepted educational boundary (Finding 4). It is required 
    // for post-sprint and all-time student trend analytics.
    let owned_sprints = ctx.db.class_sprints().teacher().filter(&sender);

    for sprint in owned_sprints {
        // Defense in depth: Solo sessions have class_sprint_id = 0
        if sprint.id == 0 { continue; } 
        
        visible_sessions.extend(
             ctx.db.sessions().class_sprint_id().filter(&sprint.id)
        );
    }

    // 2. Authorization: ALL sprints where the caller is an active CLASSROOM MEMBER
    // This allows students to view the classroom leaderboard during and after sprints.
    let member_classes: Vec<u64> = ctx.db.classroom_members().player_identity().filter(&sender)
        .map(|m| m.classroom_id).collect();
        
    for classroom_id in member_classes {
        // Find all sprints for this classroom using the BTree index
        let class_sprints = ctx.db.class_sprints().classroom_id().filter(&classroom_id);
            
        for sprint in class_sprints {
            if sprint.id == 0 { continue; }
            visible_sessions.extend(ctx.db.sessions().class_sprint_id().filter(&sprint.id));
        }
    }

    // De-duplicate in case a user is both a teacher and a member (rare but possible),
    // or if a sprint was added twice somehow.
    visible_sessions.sort_by_key(|s| s.id);
    visible_sessions.dedup_by_key(|s| s.id);

    visible_sessions
}

#[spacetimedb::view(accessor = my_classroom_answers, public)]
pub fn my_classroom_answers(ctx: &ViewContext) -> Vec<Answer> {
    let mut visible_answers = Vec::new();
    let sender = ctx.sender();
    // Security Acceptance Note: This view queries ALL answers across ALL historical sprints.
    // While a live sprint causes this to re-evaluate frequently, BTree indexing and filter() arrays
    // constrain execution. Performance bounds are documented as accepted risk (Finding 3), mitigating 
    // the complexity of maintaining separate historical and live scopes.
    let owned_sprints = ctx.db.class_sprints().teacher().filter(&sender);

    for sprint in owned_sprints {
        if sprint.id == 0 { continue; }
        for session in ctx.db.sessions().class_sprint_id().filter(&sprint.id) {
            visible_answers.extend(
                ctx.db.answers().session_id().filter(&session.id)
            );
        }
    }
    visible_answers
}

#[spacetimedb::view(accessor = my_classroom_keystrokes, public)]
pub fn my_classroom_keystrokes(ctx: &ViewContext) -> Vec<StudentKeystroke> {
    let mut visible_keystrokes = Vec::new();
    let sender = ctx.sender();

    // Keystrokes are highly transient; we strictly limit iteration to active sprints
    // to prevent unnecessary scans over historical rosters.
    let active_sprints = ctx.db.class_sprints().teacher().filter(&sender)
         .filter(|s| s.is_active);

    for sprint in active_sprints {
        if sprint.id == 0 { continue; }
        for session in ctx.db.sessions().class_sprint_id().filter(&sprint.id) {
            if let Some(keystroke) = ctx.db.student_keystrokes().student_id().find(session.player_identity) {
                visible_keystrokes.push(keystroke);
            }
        }
    }
    visible_keystrokes
}

/// Teacher view: current active problem for every student in an active class sprint.
/// Mirrors my_next_problem_results_v2 but scoped to the teacher's active sprints
/// so StudentObserverModal can show which problem a student is currently solving.
#[spacetimedb::view(accessor = my_classroom_next_problem_results_v2, public)]
pub fn my_classroom_next_problem_results_v2(ctx: &ViewContext) -> Vec<NextProblemResultV2> {
    let sender = ctx.sender();
    let mut results = Vec::new();
    for sprint in ctx.db.class_sprints().teacher().filter(&sender).filter(|s| s.is_active) {
        if sprint.id == 0 { continue; }
        for session in ctx.db.sessions().class_sprint_id().filter(&sprint.id) {
            if let Some(row) = ctx.db.next_problem_results_v2().owner().find(session.player_identity) {
                results.push(row);
            }
        }
    }
    results
}

/// Teacher view: current diagnostic problem for every student in an active diagnostic sprint.
#[spacetimedb::view(accessor = my_classroom_issued_problem_results_v2, public)]
pub fn my_classroom_issued_problem_results_v2(ctx: &ViewContext) -> Vec<IssuedProblemResultV2> {
    let sender = ctx.sender();
    let mut results = Vec::new();
    for sprint in ctx.db.class_sprints().teacher().filter(&sender).filter(|s| s.is_active) {
        if sprint.id == 0 { continue; }
        for session in ctx.db.sessions().class_sprint_id().filter(&sprint.id) {
            if let Some(row) = ctx.db.issued_problem_results_v2().owner().find(session.player_identity) {
                results.push(row);
            }
        }
    }
    results
}
