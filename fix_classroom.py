import re

with open('client/src/pages/ClassroomPage.tsx', 'r') as f:
    text = f.read()

# 1. Add imports
imports = """import ClassroomSettingsModal from '../components/classroom/ClassroomSettingsModal.js';
import ClassroomStartSprintModal from '../components/classroom/ClassroomStartSprintModal.js';
"""
text = re.sub(r"(import PageContainer from '../components/PageContainer.js';)", r"\1\n" + imports, text)

# 2. Cleanup unused states and functions
# Removing togglingVis
text = re.sub(r"  const \[togglingVis, setTogglingVis\] = useState\(false\);\n", "", text)
# Removing codeCopied
text = re.sub(r"  const \[codeCopied, setCodeCopied\] = useState\(false\);\n", "", text)
# Removing codeTextCopied
text = re.sub(r"  const \[codeTextCopied, setCodeTextCopied\] = useState\(false\);\n", "", text)
# Removing printing flags
text = re.sub(r"  const \[printing, setPrinting\] = useState\(false\);\n", "", text)
text = re.sub(r"  const \[printingModern, setPrintingModern\] = useState\(false\);\n", "", text)
text = re.sub(r"  const \[printError, setPrintError\] = useState<string \| null>\(null\);\n", "", text)
text = re.sub(r"  const \[qrStudent, setQrStudent\] = useState.*?\n", "", text)

# Delete ACCT-04 block and recovery keys
acct04_pattern = r"(?s)  // ACCT-04: Populate from class_recovery_results.*?const recoveryKeyByIdentity = [^;]+;\n\n"
text = re.sub(acct04_pattern, "", text)

# Replace memberRows to not use recoveryCode
member_rows_target = r"(?s)  // All member rows.*?}\)\.sort\(\(a, b\) => \(b.best \?\? 0\) - \(a.best \?\? 0\)\);"
new_member_rows = """  // All member rows (for the Settings Modal — shows everyone)
  const memberRows = members.map(m => {
    const id = m.playerIdentity.toHexString();
    const player = (players as unknown as Player[]).find(p => p.identity.toHexString() === id);
    return {
      id,
      username: player?.username ?? id.slice(0, 8),
      best: bestByMember.get(id),
      hidden: m.hidden as boolean,
    };
  }).sort((a, b) => (b.best ?? 0) - (a.best ?? 0));"""
text = re.sub(member_rows_target, new_member_rows, text)

# Delete isolated handlers
text = re.sub(r"(?s)  const handleToggleVisibility = async \(\) => \{.+?setTogglingVis\(false\);\n  \};\n\n", "", text)
text = re.sub(r"(?s)  const handleCopyLink = \(\) => \{.*?\n  \};\n\n", "", text)
text = re.sub(r"(?s)  const handleCopyCodeText = \(\) => \{.*?\n  \};\n\n", "", text)

# Delete Print logic
print_pattern = r"(?s)  const restoreUrl = \(code: string\) =>[^\n]+;\n\n  /\*\* Fetch recovery.*?setPrintingModern\(false\);\n    }\n  };\n\n"
text = re.sub(print_pattern, "", text)

# Delete SettingsIcon
settings_icon_pattern = r"(?s)  const SettingsIcon = \(\{ className.*?</svg>\n  \);\n"
text = re.sub(settings_icon_pattern, "", text)

# Replace Settings Modal Return
settings_modal = r"(?s)  // 1\) Config & Onboarding View \(Teacher Only\)\n  if \(showSettings && isTeacher\) \{.+?    \);\n  \}"
new_settings = """  // 1) Config & Onboarding View (Teacher Only)
  if (showSettings && isTeacher) {
    return (
      <ClassroomSettingsModal
        classroomId={classroomId}
        myClassroom={myClassroom}
        members={members}
        bestByMember={bestByMember}
        amHidden={amHidden}
        onClose={() => setShowSettings(false)}
        onLeave={() => handleLeave()}
      />
    );
  }"""
text = re.sub(settings_modal, new_settings, text)

# Replace Start Sprint Modal Return
start_sprint_modal = r"(?s)      \{\/\* Start Sprint Modal \*\/\}[\s\S]*?      \)\}\n    <\/PageContainer>"
new_start_sprint = """      {/* Start Sprint Modal */}
      {showStartModal && (
        <ClassroomStartSprintModal
          onClose={() => setShowStartModal(false)}
          onSelectType={handleStartClassSprint}
        />
      )}
    </PageContainer>"""
text = re.sub(start_sprint_modal, new_start_sprint, text)

with open('client/src/pages/ClassroomPage.tsx', 'w') as f:
    f.write(text)

print("ClassroomPage.tsx successfully fixed and rebuilt from scratch!")
