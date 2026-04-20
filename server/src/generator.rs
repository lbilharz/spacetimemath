#[repr(u32)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EduGraphKC {
    MathsMultiplicationZeroProperty = 1,
    MathsMultiplicationIdentityProperty = 2,
    MathsMultiplicationFact2s = 3,
    MathsMultiplicationFact5s = 4,
    MathsMultiplicationFact9s = 5,
    MathsMultiplicationFact10s = 6,
    MathsMultiplicationSquare = 7,
    // Legacy catch-all, no longer emitted. Kept for telemetry backward compat.
    MathsMultiplicationCommutative = 8,
    MathsMultiplicationFactHard = 9,
    MathsMultiplicationExtendedBase10 = 10,
    MathsMultiplicationExtendedCoreDigit = 11,
    MathsMultiplicationFact11s = 12,
    MathsMultiplicationFact12s = 13,
    MathsMultiplicationFact13s = 14,
    MathsMultiplicationFact14s = 15,
    MathsMultiplicationFact15s = 16,
    MathsMultiplicationFact16s = 17,
    MathsMultiplicationFact17s = 18,
    MathsMultiplicationFact18s = 19,
    MathsMultiplicationFact19s = 20,
    MathsMultiplicationFact20s = 21,
    MathsMultiplicationExtendedSquare = 22,
    MathsMultiplicationExtendedHard = 23,
    MathsMultiplicationFact3s = 24,
    MathsMultiplicationFact4s = 25,
    MathsMultiplicationFact6s = 26,
    MathsMultiplicationFact7s = 27,
    MathsMultiplicationFact8s = 28,
}

/// Highest KC value used (matches the largest variant above).  Consumers that
/// need to size a mastery vector should use KC_COUNT rather than hardcoding.
pub const KC_COUNT: usize = 28;

/// Evaluates a multiplication problem (a * b) and computes its explicit cognitive bounds.
pub fn calculate_kcs_for_multiplication(a: u8, b: u8) -> Vec<u32> {
    let mut kcs = Vec::new();

    // 1. Extended logic (a or b > 10) — unchanged.
    let max_val = std::cmp::max(a, b);
    if max_val > 10 {
        if a == b { kcs.push(EduGraphKC::MathsMultiplicationExtendedSquare as u32); }
        if a == 11 || b == 11 { kcs.push(EduGraphKC::MathsMultiplicationFact11s as u32); }
        else if a == 12 || b == 12 { kcs.push(EduGraphKC::MathsMultiplicationFact12s as u32); }
        else if a == 13 || b == 13 { kcs.push(EduGraphKC::MathsMultiplicationFact13s as u32); }
        else if a == 14 || b == 14 { kcs.push(EduGraphKC::MathsMultiplicationFact14s as u32); }
        else if a == 15 || b == 15 { kcs.push(EduGraphKC::MathsMultiplicationFact15s as u32); }
        else if a == 16 || b == 16 { kcs.push(EduGraphKC::MathsMultiplicationFact16s as u32); }
        else if a == 17 || b == 17 { kcs.push(EduGraphKC::MathsMultiplicationFact17s as u32); }
        else if a == 18 || b == 18 { kcs.push(EduGraphKC::MathsMultiplicationFact18s as u32); }
        else if a == 19 || b == 19 { kcs.push(EduGraphKC::MathsMultiplicationFact19s as u32); }
        else if a == 20 || b == 20 { kcs.push(EduGraphKC::MathsMultiplicationFact20s as u32); }

        if kcs.is_empty() {
            kcs.push(EduGraphKC::MathsMultiplicationExtendedBase10 as u32);
        }
        return kcs;
    }

    // 2. Zero & identity shortcut.
    if a == 0 || b == 0 {
        kcs.push(EduGraphKC::MathsMultiplicationZeroProperty as u32);
        return kcs;
    }
    if a == 1 || b == 1 {
        kcs.push(EduGraphKC::MathsMultiplicationIdentityProperty as u32);
        return kcs;
    }

    // 3. Squares.
    if a == b {
        kcs.push(EduGraphKC::MathsMultiplicationSquare as u32);
    }

    // 4. Fact families — emit a KC for every ×N family the pair participates in.
    //    Answering 3×7 updates BOTH Fact3s and Fact7s mastery, since the learner
    //    is practicing both tables. This gives each ×N bucket an honest signal
    //    rather than attributing every mid-range pair to the harder factor only.
    let kc_for = |f: u8| -> Option<EduGraphKC> {
        match f {
            2 => Some(EduGraphKC::MathsMultiplicationFact2s),
            3 => Some(EduGraphKC::MathsMultiplicationFact3s),
            4 => Some(EduGraphKC::MathsMultiplicationFact4s),
            5 => Some(EduGraphKC::MathsMultiplicationFact5s),
            6 => Some(EduGraphKC::MathsMultiplicationFact6s),
            7 => Some(EduGraphKC::MathsMultiplicationFact7s),
            8 => Some(EduGraphKC::MathsMultiplicationFact8s),
            9 => Some(EduGraphKC::MathsMultiplicationFact9s),
            10 => Some(EduGraphKC::MathsMultiplicationFact10s),
            _ => None,
        }
    };
    if let Some(kc) = kc_for(a) { kcs.push(kc as u32); }
    if a != b {
        if let Some(kc) = kc_for(b) { kcs.push(kc as u32); }
    }

    // 5. Hard facts — additional tag on top of the families.
    let is_hard = matches!((a, b),
        (6, 7) | (7, 6) | (6, 8) | (8, 6) | (7, 8) | (8, 7));
    if is_hard {
        kcs.push(EduGraphKC::MathsMultiplicationFactHard as u32);
    }

    kcs
}
