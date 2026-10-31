# Android real-device acceptance checklist

This checklist cannot be completed by GitHub Actions. Record genuine test evidence for each candidate app and rule signature. Do not fabricate test results.

## Required test setup
- Android device model, OS version, GKD client version, app package and app version.
- Exact upstream commit SHA and candidate rule signature.
- Import test on GKD with logs or screenshots and successful parse.
- Positive case: the intended ad/popup appears and the correct element is selected.
- Negative cases: normal app navigation, login, consent/privacy prompts, purchases, permissions, and system dialogs must not be incorrectly dismissed.
- Repeated cold/warm launches, app version changes when available, and timing/performance observations.
- Screenshot or recording evidence URL, reviewer, date, and reproducible steps.

## Evidence format
Optional `config/device-test-evidence.json`:
```json
{
  "schemaVersion": 1,
  "tests": [
    {
      "deviceId": "real-device-model-and-os",
      "appId": "com.example.app",
      "signature": "64-char-hex-sha256",
      "appVersion": "tested-version",
      "gkdVersion": "tested-client-version",
      "positivePass": true,
      "negativePass": true,
      "evidenceUrl": "https://example.org/real-test-evidence"
    }
  ]
}
```
Only enter truthful observed results. The gate checks completeness, not authenticity or correctness of external evidence. A human must inspect it before publication.

## Current decision
No six-source candidate rules may be published until redistribution permissions, rule-level review, Android tests, and final human approval are complete. Existing approved baseline remains available unchanged.
