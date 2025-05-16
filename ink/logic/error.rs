#[derive(Debug, Eq, PartialEq)]
#[ink::scale_derive(Encode, Decode, TypeInfo)]
#[allow(clippy::cast_possible_truncation)]
pub enum RaffleError {
    IncorrectDrawNumber,
    IncorrectStatus,
    IncorrectConfig,
    ConfigNotSet,
    DifferentConfig,
    IncorrectNbNumbers,
    IncorrectNumbers,
    ExistingSalt,
    DifferentResults,
    ExistingResults,
    ExistingWinners,
    AddOverFlow,
    FailedToDecode,
}
