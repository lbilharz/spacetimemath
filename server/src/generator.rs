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
}

/// Evaluates a multiplication problem (a * b) and computes its explicit cognitive bounds.
pub fn calculate_kcs_for_multiplication(a: u8, b: u8) -> Vec<u32> {
    let mut kcs = Vec::new();

    // 1. Extended Base 10 Logic (a or b > 10)
    let max_val = std::cmp::max(a, b);
    if max_val > 10 {
        kcs.push(EduGraphKC::MathsMultiplicationExtendedBase10 as u32);
        kcs.push(EduGraphKC::MathsMultiplicationExtendedCoreDigit as u32);
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
