type StepIndicatorProps = {
  currentStep: number;
  totalSteps: number;
};

const STEP_LABELS = ["Write", "Name", "Protect", "Bring Back", "Saved"];

export function StepIndicator({
  currentStep,
  totalSteps,
}: StepIndicatorProps) {
  const currentLabel = STEP_LABELS[currentStep - 1];

  return (
    <div
      className="step-indicator"
      aria-label={`Step ${currentStep} of ${totalSteps}: ${currentLabel}`}
    >
      <p className="step-count">
        <span>
          Step {currentStep} of {totalSteps}
        </span>
        <span className="step-current-label">{currentLabel}</span>
      </p>
      <ol className="step-list">
        {STEP_LABELS.slice(0, totalSteps).map((label, index) => {
          const stepNumber = index + 1;
          const state =
            stepNumber < currentStep
              ? "is-complete"
              : stepNumber === currentStep
                ? "is-current"
                : "is-upcoming";

          return (
            <li className={`step-item ${state}`} key={label}>
              <span aria-hidden="true" className="step-dot">
                {stepNumber < currentStep ? "✓" : stepNumber}
              </span>
              <span className="step-label">{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
