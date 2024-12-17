/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumberish,
  BytesLike,
  FunctionFragment,
  Result,
  Interface,
  EventFragment,
  AddressLike,
  ContractRunner,
  ContractMethod,
  Listener,
} from "ethers";
import type {
  TypedContractEvent,
  TypedDeferredTopicFilter,
  TypedEventLog,
  TypedLogDescription,
  TypedListener,
  TypedContractMethod,
} from "../common";

export declare namespace MetaTxReceiver {
  export type ForwardRequestStruct = {
    from: AddressLike;
    nonce: BigNumberish;
    data: BytesLike;
  };

  export type ForwardRequestStructOutput = [
    from: string,
    nonce: bigint,
    data: string
  ] & { from: string; nonce: bigint; data: string };
}

export interface RaffleRegistrationInterface extends Interface {
  getFunction(
    nameOrSignature:
      | "ATTESTOR_ROLE"
      | "DEFAULT_ADMIN_ROLE"
      | "DRAW_NUMBER"
      | "STATUS"
      | "canParticipate"
      | "eip712Domain"
      | "getDrawNumber"
      | "getRoleAdmin"
      | "getStatus"
      | "getStorage"
      | "grantRole"
      | "hasRole"
      | "maxNumber"
      | "metaTxGetNonce"
      | "metaTxPrepare"
      | "metaTxPrepareWithNonce"
      | "metaTxRollupU256CondEq"
      | "metaTxVerify"
      | "minNumber"
      | "nbNumbers"
      | "owner"
      | "participate"
      | "registerAttestor"
      | "registrationContractId"
      | "renounceOwnership"
      | "renounceRole"
      | "revokeRole"
      | "rollupU256CondEq"
      | "supportsInterface"
      | "toUint32Strict"
      | "transferOwnership"
  ): FunctionFragment;

  getEvent(
    nameOrSignatureOrTopic:
      | "ConfigUpdated"
      | "EIP712DomainChanged"
      | "MessageProcessedTo"
      | "MetaTxDecoded"
      | "OwnershipTransferred"
      | "ParticipationRegistered"
      | "RegistrationsClosed"
      | "RegistrationsOpen"
      | "ResultsReceived"
      | "RoleAdminChanged"
      | "RoleGranted"
      | "RoleRevoked"
      | "SaltGenerated"
      | "Started"
  ): EventFragment;

  encodeFunctionData(
    functionFragment: "ATTESTOR_ROLE",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "DEFAULT_ADMIN_ROLE",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "DRAW_NUMBER",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "STATUS", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "canParticipate",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "eip712Domain",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getDrawNumber",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getRoleAdmin",
    values: [BytesLike]
  ): string;
  encodeFunctionData(functionFragment: "getStatus", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "getStorage",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "grantRole",
    values: [BytesLike, AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "hasRole",
    values: [BytesLike, AddressLike]
  ): string;
  encodeFunctionData(functionFragment: "maxNumber", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "metaTxGetNonce",
    values: [AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "metaTxPrepare",
    values: [AddressLike, BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "metaTxPrepareWithNonce",
    values: [AddressLike, BytesLike, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "metaTxRollupU256CondEq",
    values: [MetaTxReceiver.ForwardRequestStruct, BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "metaTxVerify",
    values: [MetaTxReceiver.ForwardRequestStruct, BytesLike]
  ): string;
  encodeFunctionData(functionFragment: "minNumber", values?: undefined): string;
  encodeFunctionData(functionFragment: "nbNumbers", values?: undefined): string;
  encodeFunctionData(functionFragment: "owner", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "participate",
    values: [BigNumberish[]]
  ): string;
  encodeFunctionData(
    functionFragment: "registerAttestor",
    values: [AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "registrationContractId",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "renounceOwnership",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "renounceRole",
    values: [BytesLike, AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "revokeRole",
    values: [BytesLike, AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "rollupU256CondEq",
    values: [BytesLike[], BytesLike[], BytesLike[], BytesLike[], BytesLike[]]
  ): string;
  encodeFunctionData(
    functionFragment: "supportsInterface",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "toUint32Strict",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "transferOwnership",
    values: [AddressLike]
  ): string;

  decodeFunctionResult(
    functionFragment: "ATTESTOR_ROLE",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "DEFAULT_ADMIN_ROLE",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "DRAW_NUMBER",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "STATUS", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "canParticipate",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "eip712Domain",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getDrawNumber",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getRoleAdmin",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "getStatus", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "getStorage", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "grantRole", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "hasRole", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "maxNumber", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "metaTxGetNonce",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "metaTxPrepare",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "metaTxPrepareWithNonce",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "metaTxRollupU256CondEq",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "metaTxVerify",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "minNumber", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "nbNumbers", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "owner", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "participate",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "registerAttestor",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "registrationContractId",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "renounceOwnership",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "renounceRole",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "revokeRole", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "rollupU256CondEq",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "supportsInterface",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "toUint32Strict",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "transferOwnership",
    data: BytesLike
  ): Result;
}

export namespace ConfigUpdatedEvent {
  export type InputTuple = [
    nbNumbers: BigNumberish,
    minNumber: BigNumberish,
    maxNumber: BigNumberish
  ];
  export type OutputTuple = [
    nbNumbers: bigint,
    minNumber: bigint,
    maxNumber: bigint
  ];
  export interface OutputObject {
    nbNumbers: bigint;
    minNumber: bigint;
    maxNumber: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace EIP712DomainChangedEvent {
  export type InputTuple = [];
  export type OutputTuple = [];
  export interface OutputObject {}
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace MessageProcessedToEvent {
  export type InputTuple = [arg0: BigNumberish];
  export type OutputTuple = [arg0: bigint];
  export interface OutputObject {
    arg0: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace MetaTxDecodedEvent {
  export type InputTuple = [];
  export type OutputTuple = [];
  export interface OutputObject {}
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace OwnershipTransferredEvent {
  export type InputTuple = [previousOwner: AddressLike, newOwner: AddressLike];
  export type OutputTuple = [previousOwner: string, newOwner: string];
  export interface OutputObject {
    previousOwner: string;
    newOwner: string;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace ParticipationRegisteredEvent {
  export type InputTuple = [
    registrationContractId: BigNumberish,
    drawNumber: BigNumberish,
    participant: AddressLike,
    numbers: BigNumberish[]
  ];
  export type OutputTuple = [
    registrationContractId: bigint,
    drawNumber: bigint,
    participant: string,
    numbers: bigint[]
  ];
  export interface OutputObject {
    registrationContractId: bigint;
    drawNumber: bigint;
    participant: string;
    numbers: bigint[];
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace RegistrationsClosedEvent {
  export type InputTuple = [
    registrationContractId: BigNumberish,
    drawNumber: BigNumberish
  ];
  export type OutputTuple = [
    registrationContractId: bigint,
    drawNumber: bigint
  ];
  export interface OutputObject {
    registrationContractId: bigint;
    drawNumber: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace RegistrationsOpenEvent {
  export type InputTuple = [
    registrationContractId: BigNumberish,
    drawNumber: BigNumberish
  ];
  export type OutputTuple = [
    registrationContractId: bigint,
    drawNumber: bigint
  ];
  export interface OutputObject {
    registrationContractId: bigint;
    drawNumber: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace ResultsReceivedEvent {
  export type InputTuple = [
    registrationContractId: BigNumberish,
    drawNumber: BigNumberish,
    numbers: BigNumberish[],
    hasWinner: boolean
  ];
  export type OutputTuple = [
    registrationContractId: bigint,
    drawNumber: bigint,
    numbers: bigint[],
    hasWinner: boolean
  ];
  export interface OutputObject {
    registrationContractId: bigint;
    drawNumber: bigint;
    numbers: bigint[];
    hasWinner: boolean;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace RoleAdminChangedEvent {
  export type InputTuple = [
    role: BytesLike,
    previousAdminRole: BytesLike,
    newAdminRole: BytesLike
  ];
  export type OutputTuple = [
    role: string,
    previousAdminRole: string,
    newAdminRole: string
  ];
  export interface OutputObject {
    role: string;
    previousAdminRole: string;
    newAdminRole: string;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace RoleGrantedEvent {
  export type InputTuple = [
    role: BytesLike,
    account: AddressLike,
    sender: AddressLike
  ];
  export type OutputTuple = [role: string, account: string, sender: string];
  export interface OutputObject {
    role: string;
    account: string;
    sender: string;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace RoleRevokedEvent {
  export type InputTuple = [
    role: BytesLike,
    account: AddressLike,
    sender: AddressLike
  ];
  export type OutputTuple = [role: string, account: string, sender: string];
  export interface OutputObject {
    role: string;
    account: string;
    sender: string;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace SaltGeneratedEvent {
  export type InputTuple = [
    registrationContractId: BigNumberish,
    drawNumber: BigNumberish
  ];
  export type OutputTuple = [
    registrationContractId: bigint,
    drawNumber: bigint
  ];
  export interface OutputObject {
    registrationContractId: bigint;
    drawNumber: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace StartedEvent {
  export type InputTuple = [registrationContractId: BigNumberish];
  export type OutputTuple = [registrationContractId: bigint];
  export interface OutputObject {
    registrationContractId: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export interface RaffleRegistration extends BaseContract {
  connect(runner?: ContractRunner | null): RaffleRegistration;
  waitForDeployment(): Promise<this>;

  interface: RaffleRegistrationInterface;

  queryFilter<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEventLog<TCEvent>>>;
  queryFilter<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEventLog<TCEvent>>>;

  on<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    listener: TypedListener<TCEvent>
  ): Promise<this>;
  on<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>
  ): Promise<this>;

  once<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    listener: TypedListener<TCEvent>
  ): Promise<this>;
  once<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>
  ): Promise<this>;

  listeners<TCEvent extends TypedContractEvent>(
    event: TCEvent
  ): Promise<Array<TypedListener<TCEvent>>>;
  listeners(eventName?: string): Promise<Array<Listener>>;
  removeAllListeners<TCEvent extends TypedContractEvent>(
    event?: TCEvent
  ): Promise<this>;

  ATTESTOR_ROLE: TypedContractMethod<[], [string], "view">;

  DEFAULT_ADMIN_ROLE: TypedContractMethod<[], [string], "view">;

  DRAW_NUMBER: TypedContractMethod<[], [string], "view">;

  STATUS: TypedContractMethod<[], [string], "view">;

  canParticipate: TypedContractMethod<[], [boolean], "view">;

  eip712Domain: TypedContractMethod<
    [],
    [
      [string, string, string, bigint, string, string, bigint[]] & {
        fields: string;
        name: string;
        version: string;
        chainId: bigint;
        verifyingContract: string;
        salt: string;
        extensions: bigint[];
      }
    ],
    "view"
  >;

  getDrawNumber: TypedContractMethod<[], [bigint], "view">;

  getRoleAdmin: TypedContractMethod<[role: BytesLike], [string], "view">;

  getStatus: TypedContractMethod<[], [bigint], "view">;

  getStorage: TypedContractMethod<[key: BytesLike], [string], "view">;

  grantRole: TypedContractMethod<
    [role: BytesLike, account: AddressLike],
    [void],
    "nonpayable"
  >;

  hasRole: TypedContractMethod<
    [role: BytesLike, account: AddressLike],
    [boolean],
    "view"
  >;

  maxNumber: TypedContractMethod<[], [bigint], "view">;

  metaTxGetNonce: TypedContractMethod<[from: AddressLike], [bigint], "view">;

  metaTxPrepare: TypedContractMethod<
    [from: AddressLike, data: BytesLike],
    [[MetaTxReceiver.ForwardRequestStructOutput, string]],
    "view"
  >;

  metaTxPrepareWithNonce: TypedContractMethod<
    [from: AddressLike, data: BytesLike, nonce: BigNumberish],
    [[MetaTxReceiver.ForwardRequestStructOutput, string]],
    "view"
  >;

  metaTxRollupU256CondEq: TypedContractMethod<
    [req: MetaTxReceiver.ForwardRequestStruct, signature: BytesLike],
    [boolean],
    "nonpayable"
  >;

  metaTxVerify: TypedContractMethod<
    [req: MetaTxReceiver.ForwardRequestStruct, signature: BytesLike],
    [boolean],
    "view"
  >;

  minNumber: TypedContractMethod<[], [bigint], "view">;

  nbNumbers: TypedContractMethod<[], [bigint], "view">;

  owner: TypedContractMethod<[], [string], "view">;

  participate: TypedContractMethod<
    [_numbers: BigNumberish[]],
    [void],
    "nonpayable"
  >;

  registerAttestor: TypedContractMethod<
    [_attestor: AddressLike],
    [void],
    "nonpayable"
  >;

  registrationContractId: TypedContractMethod<[], [bigint], "view">;

  renounceOwnership: TypedContractMethod<[], [void], "nonpayable">;

  renounceRole: TypedContractMethod<
    [role: BytesLike, callerConfirmation: AddressLike],
    [void],
    "nonpayable"
  >;

  revokeRole: TypedContractMethod<
    [role: BytesLike, account: AddressLike],
    [void],
    "nonpayable"
  >;

  rollupU256CondEq: TypedContractMethod<
    [
      condKeys: BytesLike[],
      condValues: BytesLike[],
      updateKeys: BytesLike[],
      updateValues: BytesLike[],
      actions: BytesLike[]
    ],
    [boolean],
    "nonpayable"
  >;

  supportsInterface: TypedContractMethod<
    [interfaceId: BytesLike],
    [boolean],
    "view"
  >;

  toUint32Strict: TypedContractMethod<[_bytes: BytesLike], [bigint], "view">;

  transferOwnership: TypedContractMethod<
    [newOwner: AddressLike],
    [void],
    "nonpayable"
  >;

  getFunction<T extends ContractMethod = ContractMethod>(
    key: string | FunctionFragment
  ): T;

  getFunction(
    nameOrSignature: "ATTESTOR_ROLE"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "DEFAULT_ADMIN_ROLE"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "DRAW_NUMBER"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "STATUS"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "canParticipate"
  ): TypedContractMethod<[], [boolean], "view">;
  getFunction(
    nameOrSignature: "eip712Domain"
  ): TypedContractMethod<
    [],
    [
      [string, string, string, bigint, string, string, bigint[]] & {
        fields: string;
        name: string;
        version: string;
        chainId: bigint;
        verifyingContract: string;
        salt: string;
        extensions: bigint[];
      }
    ],
    "view"
  >;
  getFunction(
    nameOrSignature: "getDrawNumber"
  ): TypedContractMethod<[], [bigint], "view">;
  getFunction(
    nameOrSignature: "getRoleAdmin"
  ): TypedContractMethod<[role: BytesLike], [string], "view">;
  getFunction(
    nameOrSignature: "getStatus"
  ): TypedContractMethod<[], [bigint], "view">;
  getFunction(
    nameOrSignature: "getStorage"
  ): TypedContractMethod<[key: BytesLike], [string], "view">;
  getFunction(
    nameOrSignature: "grantRole"
  ): TypedContractMethod<
    [role: BytesLike, account: AddressLike],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "hasRole"
  ): TypedContractMethod<
    [role: BytesLike, account: AddressLike],
    [boolean],
    "view"
  >;
  getFunction(
    nameOrSignature: "maxNumber"
  ): TypedContractMethod<[], [bigint], "view">;
  getFunction(
    nameOrSignature: "metaTxGetNonce"
  ): TypedContractMethod<[from: AddressLike], [bigint], "view">;
  getFunction(
    nameOrSignature: "metaTxPrepare"
  ): TypedContractMethod<
    [from: AddressLike, data: BytesLike],
    [[MetaTxReceiver.ForwardRequestStructOutput, string]],
    "view"
  >;
  getFunction(
    nameOrSignature: "metaTxPrepareWithNonce"
  ): TypedContractMethod<
    [from: AddressLike, data: BytesLike, nonce: BigNumberish],
    [[MetaTxReceiver.ForwardRequestStructOutput, string]],
    "view"
  >;
  getFunction(
    nameOrSignature: "metaTxRollupU256CondEq"
  ): TypedContractMethod<
    [req: MetaTxReceiver.ForwardRequestStruct, signature: BytesLike],
    [boolean],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "metaTxVerify"
  ): TypedContractMethod<
    [req: MetaTxReceiver.ForwardRequestStruct, signature: BytesLike],
    [boolean],
    "view"
  >;
  getFunction(
    nameOrSignature: "minNumber"
  ): TypedContractMethod<[], [bigint], "view">;
  getFunction(
    nameOrSignature: "nbNumbers"
  ): TypedContractMethod<[], [bigint], "view">;
  getFunction(
    nameOrSignature: "owner"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "participate"
  ): TypedContractMethod<[_numbers: BigNumberish[]], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "registerAttestor"
  ): TypedContractMethod<[_attestor: AddressLike], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "registrationContractId"
  ): TypedContractMethod<[], [bigint], "view">;
  getFunction(
    nameOrSignature: "renounceOwnership"
  ): TypedContractMethod<[], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "renounceRole"
  ): TypedContractMethod<
    [role: BytesLike, callerConfirmation: AddressLike],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "revokeRole"
  ): TypedContractMethod<
    [role: BytesLike, account: AddressLike],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "rollupU256CondEq"
  ): TypedContractMethod<
    [
      condKeys: BytesLike[],
      condValues: BytesLike[],
      updateKeys: BytesLike[],
      updateValues: BytesLike[],
      actions: BytesLike[]
    ],
    [boolean],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "supportsInterface"
  ): TypedContractMethod<[interfaceId: BytesLike], [boolean], "view">;
  getFunction(
    nameOrSignature: "toUint32Strict"
  ): TypedContractMethod<[_bytes: BytesLike], [bigint], "view">;
  getFunction(
    nameOrSignature: "transferOwnership"
  ): TypedContractMethod<[newOwner: AddressLike], [void], "nonpayable">;

  getEvent(
    key: "ConfigUpdated"
  ): TypedContractEvent<
    ConfigUpdatedEvent.InputTuple,
    ConfigUpdatedEvent.OutputTuple,
    ConfigUpdatedEvent.OutputObject
  >;
  getEvent(
    key: "EIP712DomainChanged"
  ): TypedContractEvent<
    EIP712DomainChangedEvent.InputTuple,
    EIP712DomainChangedEvent.OutputTuple,
    EIP712DomainChangedEvent.OutputObject
  >;
  getEvent(
    key: "MessageProcessedTo"
  ): TypedContractEvent<
    MessageProcessedToEvent.InputTuple,
    MessageProcessedToEvent.OutputTuple,
    MessageProcessedToEvent.OutputObject
  >;
  getEvent(
    key: "MetaTxDecoded"
  ): TypedContractEvent<
    MetaTxDecodedEvent.InputTuple,
    MetaTxDecodedEvent.OutputTuple,
    MetaTxDecodedEvent.OutputObject
  >;
  getEvent(
    key: "OwnershipTransferred"
  ): TypedContractEvent<
    OwnershipTransferredEvent.InputTuple,
    OwnershipTransferredEvent.OutputTuple,
    OwnershipTransferredEvent.OutputObject
  >;
  getEvent(
    key: "ParticipationRegistered"
  ): TypedContractEvent<
    ParticipationRegisteredEvent.InputTuple,
    ParticipationRegisteredEvent.OutputTuple,
    ParticipationRegisteredEvent.OutputObject
  >;
  getEvent(
    key: "RegistrationsClosed"
  ): TypedContractEvent<
    RegistrationsClosedEvent.InputTuple,
    RegistrationsClosedEvent.OutputTuple,
    RegistrationsClosedEvent.OutputObject
  >;
  getEvent(
    key: "RegistrationsOpen"
  ): TypedContractEvent<
    RegistrationsOpenEvent.InputTuple,
    RegistrationsOpenEvent.OutputTuple,
    RegistrationsOpenEvent.OutputObject
  >;
  getEvent(
    key: "ResultsReceived"
  ): TypedContractEvent<
    ResultsReceivedEvent.InputTuple,
    ResultsReceivedEvent.OutputTuple,
    ResultsReceivedEvent.OutputObject
  >;
  getEvent(
    key: "RoleAdminChanged"
  ): TypedContractEvent<
    RoleAdminChangedEvent.InputTuple,
    RoleAdminChangedEvent.OutputTuple,
    RoleAdminChangedEvent.OutputObject
  >;
  getEvent(
    key: "RoleGranted"
  ): TypedContractEvent<
    RoleGrantedEvent.InputTuple,
    RoleGrantedEvent.OutputTuple,
    RoleGrantedEvent.OutputObject
  >;
  getEvent(
    key: "RoleRevoked"
  ): TypedContractEvent<
    RoleRevokedEvent.InputTuple,
    RoleRevokedEvent.OutputTuple,
    RoleRevokedEvent.OutputObject
  >;
  getEvent(
    key: "SaltGenerated"
  ): TypedContractEvent<
    SaltGeneratedEvent.InputTuple,
    SaltGeneratedEvent.OutputTuple,
    SaltGeneratedEvent.OutputObject
  >;
  getEvent(
    key: "Started"
  ): TypedContractEvent<
    StartedEvent.InputTuple,
    StartedEvent.OutputTuple,
    StartedEvent.OutputObject
  >;

  filters: {
    "ConfigUpdated(uint8,uint256,uint256)": TypedContractEvent<
      ConfigUpdatedEvent.InputTuple,
      ConfigUpdatedEvent.OutputTuple,
      ConfigUpdatedEvent.OutputObject
    >;
    ConfigUpdated: TypedContractEvent<
      ConfigUpdatedEvent.InputTuple,
      ConfigUpdatedEvent.OutputTuple,
      ConfigUpdatedEvent.OutputObject
    >;

    "EIP712DomainChanged()": TypedContractEvent<
      EIP712DomainChangedEvent.InputTuple,
      EIP712DomainChangedEvent.OutputTuple,
      EIP712DomainChangedEvent.OutputObject
    >;
    EIP712DomainChanged: TypedContractEvent<
      EIP712DomainChangedEvent.InputTuple,
      EIP712DomainChangedEvent.OutputTuple,
      EIP712DomainChangedEvent.OutputObject
    >;

    "MessageProcessedTo(uint256)": TypedContractEvent<
      MessageProcessedToEvent.InputTuple,
      MessageProcessedToEvent.OutputTuple,
      MessageProcessedToEvent.OutputObject
    >;
    MessageProcessedTo: TypedContractEvent<
      MessageProcessedToEvent.InputTuple,
      MessageProcessedToEvent.OutputTuple,
      MessageProcessedToEvent.OutputObject
    >;

    "MetaTxDecoded()": TypedContractEvent<
      MetaTxDecodedEvent.InputTuple,
      MetaTxDecodedEvent.OutputTuple,
      MetaTxDecodedEvent.OutputObject
    >;
    MetaTxDecoded: TypedContractEvent<
      MetaTxDecodedEvent.InputTuple,
      MetaTxDecodedEvent.OutputTuple,
      MetaTxDecodedEvent.OutputObject
    >;

    "OwnershipTransferred(address,address)": TypedContractEvent<
      OwnershipTransferredEvent.InputTuple,
      OwnershipTransferredEvent.OutputTuple,
      OwnershipTransferredEvent.OutputObject
    >;
    OwnershipTransferred: TypedContractEvent<
      OwnershipTransferredEvent.InputTuple,
      OwnershipTransferredEvent.OutputTuple,
      OwnershipTransferredEvent.OutputObject
    >;

    "ParticipationRegistered(uint256,uint256,address,uint256[])": TypedContractEvent<
      ParticipationRegisteredEvent.InputTuple,
      ParticipationRegisteredEvent.OutputTuple,
      ParticipationRegisteredEvent.OutputObject
    >;
    ParticipationRegistered: TypedContractEvent<
      ParticipationRegisteredEvent.InputTuple,
      ParticipationRegisteredEvent.OutputTuple,
      ParticipationRegisteredEvent.OutputObject
    >;

    "RegistrationsClosed(uint256,uint256)": TypedContractEvent<
      RegistrationsClosedEvent.InputTuple,
      RegistrationsClosedEvent.OutputTuple,
      RegistrationsClosedEvent.OutputObject
    >;
    RegistrationsClosed: TypedContractEvent<
      RegistrationsClosedEvent.InputTuple,
      RegistrationsClosedEvent.OutputTuple,
      RegistrationsClosedEvent.OutputObject
    >;

    "RegistrationsOpen(uint256,uint256)": TypedContractEvent<
      RegistrationsOpenEvent.InputTuple,
      RegistrationsOpenEvent.OutputTuple,
      RegistrationsOpenEvent.OutputObject
    >;
    RegistrationsOpen: TypedContractEvent<
      RegistrationsOpenEvent.InputTuple,
      RegistrationsOpenEvent.OutputTuple,
      RegistrationsOpenEvent.OutputObject
    >;

    "ResultsReceived(uint256,uint256,uint256[],bool)": TypedContractEvent<
      ResultsReceivedEvent.InputTuple,
      ResultsReceivedEvent.OutputTuple,
      ResultsReceivedEvent.OutputObject
    >;
    ResultsReceived: TypedContractEvent<
      ResultsReceivedEvent.InputTuple,
      ResultsReceivedEvent.OutputTuple,
      ResultsReceivedEvent.OutputObject
    >;

    "RoleAdminChanged(bytes32,bytes32,bytes32)": TypedContractEvent<
      RoleAdminChangedEvent.InputTuple,
      RoleAdminChangedEvent.OutputTuple,
      RoleAdminChangedEvent.OutputObject
    >;
    RoleAdminChanged: TypedContractEvent<
      RoleAdminChangedEvent.InputTuple,
      RoleAdminChangedEvent.OutputTuple,
      RoleAdminChangedEvent.OutputObject
    >;

    "RoleGranted(bytes32,address,address)": TypedContractEvent<
      RoleGrantedEvent.InputTuple,
      RoleGrantedEvent.OutputTuple,
      RoleGrantedEvent.OutputObject
    >;
    RoleGranted: TypedContractEvent<
      RoleGrantedEvent.InputTuple,
      RoleGrantedEvent.OutputTuple,
      RoleGrantedEvent.OutputObject
    >;

    "RoleRevoked(bytes32,address,address)": TypedContractEvent<
      RoleRevokedEvent.InputTuple,
      RoleRevokedEvent.OutputTuple,
      RoleRevokedEvent.OutputObject
    >;
    RoleRevoked: TypedContractEvent<
      RoleRevokedEvent.InputTuple,
      RoleRevokedEvent.OutputTuple,
      RoleRevokedEvent.OutputObject
    >;

    "SaltGenerated(uint256,uint256)": TypedContractEvent<
      SaltGeneratedEvent.InputTuple,
      SaltGeneratedEvent.OutputTuple,
      SaltGeneratedEvent.OutputObject
    >;
    SaltGenerated: TypedContractEvent<
      SaltGeneratedEvent.InputTuple,
      SaltGeneratedEvent.OutputTuple,
      SaltGeneratedEvent.OutputObject
    >;

    "Started(uint256)": TypedContractEvent<
      StartedEvent.InputTuple,
      StartedEvent.OutputTuple,
      StartedEvent.OutputObject
    >;
    Started: TypedContractEvent<
      StartedEvent.InputTuple,
      StartedEvent.OutputTuple,
      StartedEvent.OutputObject
    >;
  };
}
