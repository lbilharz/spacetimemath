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
}

/// Evaluates a multiplication problem (a * b) and computes its explicit cognitive bounds.
pub fn calculate_kcs_for_multiplication(a: u8, b: u8) -> Vec<u32> {
    let mut kcs = Vec::new();

    // 1. Extended Logic (a or b > 10)
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

    // 2. Base Patterns within 1x1 table
    if a == 0 || b == 0 {
        kcs.push(EduGraphKC::MathsMultiplicationZeroProperty as u32);
        return kcs; 
    }
    if a == 1 || b == 1 {
        kcs.push(EduGraphKC::MathsMultiplicationIdentityProperty as u32);
        return kcs; 
    }

    // 3. Squares
    if a == b {
        kcs.push(EduGraphKC::MathsMultiplicationSquare as u32);
    }

    // 4. Fact Families
    if a == 2 || b == 2 {
        kcs.push(EduGraphKC::MathsMultiplicationFact2s as u32);
    } else if a == 5 || b == 5 {
        kcs.push(EduGraphKC::MathsMultiplicationFact5s as u32);
    } else if a == 9 || b == 9 {
        kcs.push(EduGraphKC::MathsMultiplicationFact9s as u32);
    } else if a == 10 || b == 10 {
        kcs.push(EduGraphKC::MathsMultiplicationFact10s as u32);
    }

    // 5. The "Hard Facts"
    let is_hard = match (a, b) {
        (6, 7) | (7, 6) | (6, 8) | (8, 6) | (7, 8) | (8, 7) => true,
        _ => false,
    };
    if is_hard {
        kcs.push(EduGraphKC::MathsMultiplicationFactHard as u32);
    }

    kcs
}
