declare namespace destination {
    let type_118: string;
    export { type_118 as type };
    export namespace properties_44 {
        export namespace BucketAccountId {
            let type_119: string;
            export { type_119 as type };
            let pattern_4: string;
            export { pattern_4 as pattern };
        }
        export namespace BucketArn {
            let $ref_7: string;
            export { $ref_7 as $ref };
        }
        export namespace Format {
            let _enum_17: string[];
            export { _enum_17 as enum };
        }
        export namespace Prefix_7 {
            let type_120: string;
            export { type_120 as type };
        }
        export { Prefix_7 as Prefix };
    }
    export { properties_44 as properties };
    let required_29: string[];
    export { required_29 as required };
    let additionalProperties_44: boolean;
    export { additionalProperties_44 as additionalProperties };
}
declare namespace tagFilter {
    let type_121: string;
    export { type_121 as type };
    export namespace properties_45 {
        export namespace Key_1 {
            let type_122: string;
            export { type_122 as type };
        }
        export { Key_1 as Key };
        export namespace Value_1 {
            let type_123: string;
            export { type_123 as type };
        }
        export { Value_1 as Value };
    }
    export { properties_45 as properties };
    let required_30: string[];
    export { required_30 as required };
    let additionalProperties_45: boolean;
    export { additionalProperties_45 as additionalProperties };
}
declare namespace noncurrentVersionTransition {
    let type_124: string;
    export { type_124 as type };
    export namespace properties_46 {
        export namespace StorageClass_2 {
            let _enum_18: string[];
            export { _enum_18 as enum };
        }
        export { StorageClass_2 as StorageClass };
        export namespace TransitionInDays_1 {
            let type_125: string;
            export { type_125 as type };
            let minimum_6: number;
            export { minimum_6 as minimum };
        }
        export { TransitionInDays_1 as TransitionInDays };
    }
    export { properties_46 as properties };
    let required_31: string[];
    export { required_31 as required };
    let additionalProperties_46: boolean;
    export { additionalProperties_46 as additionalProperties };
}
declare namespace notificationFilter {
    let type_126: string;
    export { type_126 as type };
    export namespace properties_47 {
        namespace S3Key {
            let type_127: string;
            export { type_127 as type };
            export namespace properties_48 {
                export namespace Rules_2 {
                    let type_128: string;
                    export { type_128 as type };
                    export namespace items_18 {
                        let type_129: string;
                        export { type_129 as type };
                        export namespace properties_49 {
                            export namespace Name {
                                let _enum_19: string[];
                                export { _enum_19 as enum };
                            }
                            export namespace Value_2 {
                                let type_130: string;
                                export { type_130 as type };
                            }
                            export { Value_2 as Value };
                        }
                        export { properties_49 as properties };
                        let required_32: string[];
                        export { required_32 as required };
                        let additionalProperties_47: boolean;
                        export { additionalProperties_47 as additionalProperties };
                    }
                    export { items_18 as items };
                }
                export { Rules_2 as Rules };
            }
            export { properties_48 as properties };
            let required_33: string[];
            export { required_33 as required };
            let additionalProperties_48: boolean;
            export { additionalProperties_48 as additionalProperties };
        }
    }
    export { properties_47 as properties };
    let required_34: string[];
    export { required_34 as required };
    let additionalProperties_49: boolean;
    export { additionalProperties_49 as additionalProperties };
}
declare namespace replicationTimeValue {
    let type_131: string;
    export { type_131 as type };
    export namespace properties_50 {
        namespace Minutes {
            let type_132: string;
            export { type_132 as type };
            let minimum_7: number;
            export { minimum_7 as minimum };
        }
    }
    export { properties_50 as properties };
    let required_35: string[];
    export { required_35 as required };
    let additionalProperties_50: boolean;
    export { additionalProperties_50 as additionalProperties };
}
export declare let type: string;
export declare namespace properties {
    namespace accelerateConfiguration {
        let type_1: string;
        export { type_1 as type };
        export namespace properties_1 {
            namespace AccelerationStatus {
                let _enum: string[];
                export { _enum as enum };
            }
        }
        export { properties_1 as properties };
        export let required: string[];
        export let additionalProperties: boolean;
    }
    namespace accessControl {
        let type_2: string;
        export { type_2 as type };
    }
    namespace analyticsConfigurations {
        let type_3: string;
        export { type_3 as type };
        export namespace items {
            let type_4: string;
            export { type_4 as type };
            export namespace properties_2 {
                namespace Id {
                    let type_5: string;
                    export { type_5 as type };
                }
                namespace Prefix {
                    let type_6: string;
                    export { type_6 as type };
                }
                namespace StorageClassAnalysis {
                    let type_7: string;
                    export { type_7 as type };
                    export namespace properties_3 {
                        namespace DataExport {
                            let type_8: string;
                            export { type_8 as type };
                            export namespace properties_4 {
                                export { destination as Destination };
                                export namespace OutputSchemaVersion {
                                    let _const: string;
                                    export { _const as const };
                                }
                            }
                            export { properties_4 as properties };
                            let required_1: string[];
                            export { required_1 as required };
                            let additionalProperties_1: boolean;
                            export { additionalProperties_1 as additionalProperties };
                        }
                    }
                    export { properties_3 as properties };
                    let additionalProperties_2: boolean;
                    export { additionalProperties_2 as additionalProperties };
                }
                namespace TagFilters {
                    let type_9: string;
                    export { type_9 as type };
                    export { tagFilter as items };
                }
            }
            export { properties_2 as properties };
            let required_2: string[];
            export { required_2 as required };
            let additionalProperties_3: boolean;
            export { additionalProperties_3 as additionalProperties };
        }
    }
    namespace bucketEncryption {
        let type_10: string;
        export { type_10 as type };
        export namespace properties_5 {
            namespace ServerSideEncryptionConfiguration {
                let type_11: string;
                export { type_11 as type };
                export namespace items_1 {
                    let type_12: string;
                    export { type_12 as type };
                    export namespace properties_6 {
                        namespace ServerSideEncryptionByDefault {
                            let type_13: string;
                            export { type_13 as type };
                            export namespace properties_7 {
                                namespace KMSMasterKeyID {
                                    let anyOf: ({
                                        $ref: string;
                                        type?: undefined;
                                        pattern?: undefined;
                                    } | {
                                        type: string;
                                        pattern: string;
                                        $ref?: undefined;
                                    })[];
                                }
                                namespace SSEAlgorithm {
                                    let _enum_1: string[];
                                    export { _enum_1 as enum };
                                }
                            }
                            export { properties_7 as properties };
                            let required_3: string[];
                            export { required_3 as required };
                            let additionalProperties_4: boolean;
                            export { additionalProperties_4 as additionalProperties };
                        }
                        namespace BucketKeyEnabled {
                            let type_14: string;
                            export { type_14 as type };
                        }
                    }
                    export { properties_6 as properties };
                    let additionalProperties_5: boolean;
                    export { additionalProperties_5 as additionalProperties };
                }
                export { items_1 as items };
            }
        }
        export { properties_5 as properties };
        let required_4: string[];
        export { required_4 as required };
        let additionalProperties_6: boolean;
        export { additionalProperties_6 as additionalProperties };
    }
    namespace bucketName {
        let $ref: string;
    }
    namespace corsConfiguration {
        let type_15: string;
        export { type_15 as type };
        export namespace properties_8 {
            namespace CorsRules {
                let type_16: string;
                export { type_16 as type };
                export namespace items_2 {
                    let type_17: string;
                    export { type_17 as type };
                    export namespace properties_9 {
                        export namespace AllowedHeaders {
                            let type_18: string;
                            export { type_18 as type };
                            export namespace items_3 {
                                let type_19: string;
                                export { type_19 as type };
                            }
                            export { items_3 as items };
                        }
                        export namespace AllowedMethods {
                            let type_20: string;
                            export { type_20 as type };
                            export namespace items_4 {
                                let _enum_2: string[];
                                export { _enum_2 as enum };
                            }
                            export { items_4 as items };
                        }
                        export namespace AllowedOrigins {
                            let type_21: string;
                            export { type_21 as type };
                            export namespace items_5 {
                                let type_22: string;
                                export { type_22 as type };
                            }
                            export { items_5 as items };
                        }
                        export namespace ExposedHeaders {
                            let type_23: string;
                            export { type_23 as type };
                            export namespace items_6 {
                                let type_24: string;
                                export { type_24 as type };
                            }
                            export { items_6 as items };
                        }
                        export namespace Id_1 {
                            let type_25: string;
                            export { type_25 as type };
                            export let maxLength: number;
                        }
                        export { Id_1 as Id };
                        export namespace MaxAge {
                            let type_26: string;
                            export { type_26 as type };
                            export let minimum: number;
                        }
                    }
                    export { properties_9 as properties };
                    let required_5: string[];
                    export { required_5 as required };
                    let additionalProperties_7: boolean;
                    export { additionalProperties_7 as additionalProperties };
                }
                export { items_2 as items };
                export let maxItems: number;
            }
        }
        export { properties_8 as properties };
        let required_6: string[];
        export { required_6 as required };
        let additionalProperties_8: boolean;
        export { additionalProperties_8 as additionalProperties };
    }
    namespace inventoryConfigurations {
        let type_27: string;
        export { type_27 as type };
        export namespace items_7 {
            let type_28: string;
            export { type_28 as type };
            export namespace properties_10 {
                export { destination as Destination };
                export namespace Enabled {
                    let type_29: string;
                    export { type_29 as type };
                }
                export namespace Id_2 {
                    let type_30: string;
                    export { type_30 as type };
                }
                export { Id_2 as Id };
                export namespace IncludedObjectVersions {
                    let _enum_3: string[];
                    export { _enum_3 as enum };
                }
                export namespace OptionalFields {
                    let type_31: string;
                    export { type_31 as type };
                    export namespace items_8 {
                        let type_32: string;
                        export { type_32 as type };
                    }
                    export { items_8 as items };
                }
                export namespace Prefix_1 {
                    let type_33: string;
                    export { type_33 as type };
                }
                export { Prefix_1 as Prefix };
                export namespace ScheduleFrequency {
                    let _enum_4: string[];
                    export { _enum_4 as enum };
                }
            }
            export { properties_10 as properties };
            let required_7: string[];
            export { required_7 as required };
            let additionalProperties_9: boolean;
            export { additionalProperties_9 as additionalProperties };
        }
        export { items_7 as items };
    }
    namespace lifecycleConfiguration {
        let type_34: string;
        export { type_34 as type };
        export namespace properties_11 {
            namespace Rules {
                let type_35: string;
                export { type_35 as type };
                export namespace items_9 {
                    let type_36: string;
                    export { type_36 as type };
                    export namespace properties_12 {
                        export namespace AbortIncompleteMultipartUpload {
                            let type_37: string;
                            export { type_37 as type };
                            export namespace properties_13 {
                                namespace DaysAfterInitiation {
                                    let type_38: string;
                                    export { type_38 as type };
                                    let minimum_1: number;
                                    export { minimum_1 as minimum };
                                }
                            }
                            export { properties_13 as properties };
                            let required_8: string[];
                            export { required_8 as required };
                            let additionalProperties_10: boolean;
                            export { additionalProperties_10 as additionalProperties };
                        }
                        export namespace ExpirationDate {
                            let type_39: string;
                            export { type_39 as type };
                            export let format: string;
                        }
                        export let ExpirationInDays: {
                            anyOf: any[];
                        };
                        export namespace Id_3 {
                            let type_40: string;
                            export { type_40 as type };
                            let maxLength_1: number;
                            export { maxLength_1 as maxLength };
                        }
                        export { Id_3 as Id };
                        export namespace NoncurrentVersionExpirationInDays {
                            let type_41: string;
                            export { type_41 as type };
                            let minimum_2: number;
                            export { minimum_2 as minimum };
                        }
                        export { noncurrentVersionTransition as NoncurrentVersionTransition };
                        export namespace NoncurrentVersionTransitions {
                            let type_42: string;
                            export { type_42 as type };
                            export { noncurrentVersionTransition as items };
                        }
                        export namespace Prefix_2 {
                            let type_43: string;
                            export { type_43 as type };
                        }
                        export { Prefix_2 as Prefix };
                        export namespace Status {
                            let _enum_5: string[];
                            export { _enum_5 as enum };
                        }
                        export namespace TagFilters_1 {
                            let type_44: string;
                            export { type_44 as type };
                            export { tagFilter as items };
                        }
                        export { TagFilters_1 as TagFilters };
                        export namespace Transitions {
                            let type_45: string;
                            export { type_45 as type };
                            export namespace items_10 {
                                let type_46: string;
                                export { type_46 as type };
                                export namespace properties_14 {
                                    namespace StorageClass {
                                        let _enum_6: string[];
                                        export { _enum_6 as enum };
                                    }
                                    namespace TransitionDate {
                                        let type_47: string;
                                        export { type_47 as type };
                                        let format_1: string;
                                        export { format_1 as format };
                                    }
                                    namespace TransitionInDays {
                                        let type_48: string;
                                        export { type_48 as type };
                                        let minimum_3: number;
                                        export { minimum_3 as minimum };
                                    }
                                }
                                export { properties_14 as properties };
                                let required_9: string[];
                                export { required_9 as required };
                                let additionalProperties_11: boolean;
                                export { additionalProperties_11 as additionalProperties };
                            }
                            export { items_10 as items };
                        }
                    }
                    export { properties_12 as properties };
                    let required_10: string[];
                    export { required_10 as required };
                    let anyOf_1: {
                        required: string[];
                    }[];
                    export { anyOf_1 as anyOf };
                    let additionalProperties_12: boolean;
                    export { additionalProperties_12 as additionalProperties };
                }
                export { items_9 as items };
            }
        }
        export { properties_11 as properties };
        let required_11: string[];
        export { required_11 as required };
        let additionalProperties_13: boolean;
        export { additionalProperties_13 as additionalProperties };
    }
    namespace loggingConfiguration {
        let type_49: string;
        export { type_49 as type };
        export namespace properties_15 {
            namespace DestinationBucketName {
                let anyOf_2: {
                    $ref: string;
                }[];
                export { anyOf_2 as anyOf };
            }
            namespace LogFilePrefix {
                let type_50: string;
                export { type_50 as type };
            }
        }
        export { properties_15 as properties };
        let additionalProperties_14: boolean;
        export { additionalProperties_14 as additionalProperties };
    }
    namespace metricsConfigurations {
        let type_51: string;
        export { type_51 as type };
        export namespace items_11 {
            let type_52: string;
            export { type_52 as type };
            export namespace properties_16 {
                export namespace Id_4 {
                    let type_53: string;
                    export { type_53 as type };
                }
                export { Id_4 as Id };
                export namespace Prefix_3 {
                    let type_54: string;
                    export { type_54 as type };
                }
                export { Prefix_3 as Prefix };
                export namespace TagFilters_2 {
                    let type_55: string;
                    export { type_55 as type };
                    export { tagFilter as items };
                }
                export { TagFilters_2 as TagFilters };
            }
            export { properties_16 as properties };
            let required_12: string[];
            export { required_12 as required };
            let additionalProperties_15: boolean;
            export { additionalProperties_15 as additionalProperties };
        }
        export { items_11 as items };
    }
    namespace name {
        let $ref_1: string;
        export { $ref_1 as $ref };
    }
    namespace notificationConfiguration {
        let type_56: string;
        export { type_56 as type };
        export namespace properties_17 {
            namespace LambdaConfigurations {
                let type_57: string;
                export { type_57 as type };
                export namespace items_12 {
                    let type_58: string;
                    export { type_58 as type };
                    export namespace properties_18 {
                        export namespace Event {
                            let type_59: string;
                            export { type_59 as type };
                            export let pattern: string;
                        }
                        export { notificationFilter as Filter };
                        export namespace Function {
                            let $ref_2: string;
                            export { $ref_2 as $ref };
                        }
                    }
                    export { properties_18 as properties };
                    let required_13: string[];
                    export { required_13 as required };
                    let additionalProperties_16: boolean;
                    export { additionalProperties_16 as additionalProperties };
                }
                export { items_12 as items };
            }
            namespace QueueConfigurations {
                let type_60: string;
                export { type_60 as type };
                export namespace items_13 {
                    let type_61: string;
                    export { type_61 as type };
                    export namespace properties_19 {
                        export namespace Event_1 {
                            let type_62: string;
                            export { type_62 as type };
                            let pattern_1: string;
                            export { pattern_1 as pattern };
                        }
                        export { Event_1 as Event };
                        export { notificationFilter as Filter };
                        export namespace Queue {
                            let $ref_3: string;
                            export { $ref_3 as $ref };
                        }
                    }
                    export { properties_19 as properties };
                    let required_14: string[];
                    export { required_14 as required };
                    let additionalProperties_17: boolean;
                    export { additionalProperties_17 as additionalProperties };
                }
                export { items_13 as items };
            }
            namespace TopicConfigurations {
                let type_63: string;
                export { type_63 as type };
                export namespace items_14 {
                    let type_64: string;
                    export { type_64 as type };
                    export namespace properties_20 {
                        export namespace Event_2 {
                            let type_65: string;
                            export { type_65 as type };
                            let pattern_2: string;
                            export { pattern_2 as pattern };
                        }
                        export { Event_2 as Event };
                        export { notificationFilter as Filter };
                        export namespace Topic {
                            let $ref_4: string;
                            export { $ref_4 as $ref };
                        }
                    }
                    export { properties_20 as properties };
                    let required_15: string[];
                    export { required_15 as required };
                    let additionalProperties_18: boolean;
                    export { additionalProperties_18 as additionalProperties };
                }
                export { items_14 as items };
            }
        }
        export { properties_17 as properties };
        let additionalProperties_19: boolean;
        export { additionalProperties_19 as additionalProperties };
    }
    namespace objectLockConfiguration {
        let type_66: string;
        export { type_66 as type };
        export namespace properties_21 {
            namespace ObjectLockEnabled {
                let _const_1: string;
                export { _const_1 as const };
            }
            namespace Rule {
                let type_67: string;
                export { type_67 as type };
                export namespace properties_22 {
                    namespace DefaultRetention {
                        let type_68: string;
                        export { type_68 as type };
                        export namespace properties_23 {
                            namespace Days {
                                let type_69: string;
                                export { type_69 as type };
                                let minimum_4: number;
                                export { minimum_4 as minimum };
                            }
                            namespace Mode {
                                let _enum_7: string[];
                                export { _enum_7 as enum };
                            }
                            namespace Years {
                                let type_70: string;
                                export { type_70 as type };
                                let minimum_5: number;
                                export { minimum_5 as minimum };
                            }
                        }
                        export { properties_23 as properties };
                        let additionalProperties_20: boolean;
                        export { additionalProperties_20 as additionalProperties };
                    }
                }
                export { properties_22 as properties };
                let additionalProperties_21: boolean;
                export { additionalProperties_21 as additionalProperties };
            }
        }
        export { properties_21 as properties };
        let additionalProperties_22: boolean;
        export { additionalProperties_22 as additionalProperties };
    }
    namespace objectLockEnabled {
        let type_71: string;
        export { type_71 as type };
    }
    namespace publicAccessBlockConfiguration {
        let type_72: string;
        export { type_72 as type };
        export namespace properties_24 {
            namespace BlockPublicAcls {
                let type_73: string;
                export { type_73 as type };
            }
            namespace BlockPublicPolicy {
                let type_74: string;
                export { type_74 as type };
            }
            namespace IgnorePublicAcls {
                let type_75: string;
                export { type_75 as type };
            }
            namespace RestrictPublicBuckets {
                let type_76: string;
                export { type_76 as type };
            }
        }
        export { properties_24 as properties };
        let additionalProperties_23: boolean;
        export { additionalProperties_23 as additionalProperties };
    }
    namespace replicationConfiguration {
        let type_77: string;
        export { type_77 as type };
        export namespace properties_25 {
            export namespace Role {
                let $ref_5: string;
                export { $ref_5 as $ref };
            }
            export namespace Rules_1 {
                let type_78: string;
                export { type_78 as type };
                export namespace items_15 {
                    let type_79: string;
                    export { type_79 as type };
                    export namespace properties_26 {
                        export namespace DeleteMarkerReplication {
                            let type_80: string;
                            export { type_80 as type };
                            export namespace properties_27 {
                                export namespace Status_1 {
                                    let _enum_8: string[];
                                    export { _enum_8 as enum };
                                }
                                export { Status_1 as Status };
                            }
                            export { properties_27 as properties };
                            let additionalProperties_24: boolean;
                            export { additionalProperties_24 as additionalProperties };
                        }
                        export namespace Destination {
                            let type_81: string;
                            export { type_81 as type };
                            export namespace properties_28 {
                                export namespace AccessControlTranslation {
                                    let type_82: string;
                                    export { type_82 as type };
                                    export namespace properties_29 {
                                        namespace Owner {
                                            let _const_2: string;
                                            export { _const_2 as const };
                                        }
                                    }
                                    export { properties_29 as properties };
                                    let required_16: string[];
                                    export { required_16 as required };
                                    let additionalProperties_25: boolean;
                                    export { additionalProperties_25 as additionalProperties };
                                }
                                export namespace Account {
                                    let type_83: string;
                                    export { type_83 as type };
                                    let pattern_3: string;
                                    export { pattern_3 as pattern };
                                }
                                export namespace Bucket {
                                    let $ref_6: string;
                                    export { $ref_6 as $ref };
                                }
                                export namespace EncryptionConfiguration {
                                    let type_84: string;
                                    export { type_84 as type };
                                    export namespace properties_30 {
                                        namespace ReplicaKmsKeyID {
                                            let type_85: string;
                                            export { type_85 as type };
                                        }
                                    }
                                    export { properties_30 as properties };
                                    let required_17: string[];
                                    export { required_17 as required };
                                    let additionalProperties_26: boolean;
                                    export { additionalProperties_26 as additionalProperties };
                                }
                                export namespace Metrics {
                                    let type_86: string;
                                    export { type_86 as type };
                                    export namespace properties_31 {
                                        export { replicationTimeValue as EventThreshold };
                                        export namespace Status_2 {
                                            let _enum_9: string[];
                                            export { _enum_9 as enum };
                                        }
                                        export { Status_2 as Status };
                                    }
                                    export { properties_31 as properties };
                                    let required_18: string[];
                                    export { required_18 as required };
                                    let additionalProperties_27: boolean;
                                    export { additionalProperties_27 as additionalProperties };
                                }
                                export namespace ReplicationTime {
                                    let type_87: string;
                                    export { type_87 as type };
                                    export namespace properties_32 {
                                        export namespace Status_3 {
                                            let _enum_10: string[];
                                            export { _enum_10 as enum };
                                        }
                                        export { Status_3 as Status };
                                        export { replicationTimeValue as Time };
                                    }
                                    export { properties_32 as properties };
                                    let required_19: string[];
                                    export { required_19 as required };
                                    let additionalProperties_28: boolean;
                                    export { additionalProperties_28 as additionalProperties };
                                }
                                export namespace StorageClass_1 {
                                    let _enum_11: string[];
                                    export { _enum_11 as enum };
                                }
                                export { StorageClass_1 as StorageClass };
                            }
                            export { properties_28 as properties };
                            let required_20: string[];
                            export { required_20 as required };
                            let additionalProperties_29: boolean;
                            export { additionalProperties_29 as additionalProperties };
                            export namespace dependencies {
                                let AccessControlTranslation_1: string[];
                                export { AccessControlTranslation_1 as AccessControlTranslation };
                            }
                        }
                        export namespace Filter {
                            let type_88: string;
                            export { type_88 as type };
                            export namespace properties_33 {
                                export namespace And {
                                    let type_89: string;
                                    export { type_89 as type };
                                    export namespace properties_34 {
                                        export namespace Prefix_4 {
                                            let type_90: string;
                                            export { type_90 as type };
                                        }
                                        export { Prefix_4 as Prefix };
                                        export namespace TagFilters_3 {
                                            let type_91: string;
                                            export { type_91 as type };
                                            export { tagFilter as items };
                                        }
                                        export { TagFilters_3 as TagFilters };
                                    }
                                    export { properties_34 as properties };
                                    let additionalProperties_30: boolean;
                                    export { additionalProperties_30 as additionalProperties };
                                }
                                export namespace Prefix_5 {
                                    let type_92: string;
                                    export { type_92 as type };
                                }
                                export { Prefix_5 as Prefix };
                                export { tagFilter as TagFilter };
                            }
                            export { properties_33 as properties };
                            let additionalProperties_31: boolean;
                            export { additionalProperties_31 as additionalProperties };
                        }
                        export namespace Id_5 {
                            let type_93: string;
                            export { type_93 as type };
                            let maxLength_2: number;
                            export { maxLength_2 as maxLength };
                        }
                        export { Id_5 as Id };
                        export namespace Prefix_6 {
                            let type_94: string;
                            export { type_94 as type };
                        }
                        export { Prefix_6 as Prefix };
                        export namespace Priority {
                            let type_95: string;
                            export { type_95 as type };
                        }
                        export namespace SourceSelectionCriteria {
                            let type_96: string;
                            export { type_96 as type };
                            export namespace properties_35 {
                                namespace SseKmsEncryptedObjects {
                                    let type_97: string;
                                    export { type_97 as type };
                                    export namespace properties_36 {
                                        export namespace Status_4 {
                                            let _enum_12: string[];
                                            export { _enum_12 as enum };
                                        }
                                        export { Status_4 as Status };
                                    }
                                    export { properties_36 as properties };
                                    let required_21: string[];
                                    export { required_21 as required };
                                    let additionalProperties_32: boolean;
                                    export { additionalProperties_32 as additionalProperties };
                                }
                            }
                            export { properties_35 as properties };
                            let required_22: string[];
                            export { required_22 as required };
                            let additionalProperties_33: boolean;
                            export { additionalProperties_33 as additionalProperties };
                        }
                        export namespace Status_5 {
                            let _enum_13: string[];
                            export { _enum_13 as enum };
                        }
                        export { Status_5 as Status };
                    }
                    export { properties_26 as properties };
                    let required_23: string[];
                    export { required_23 as required };
                    let additionalProperties_34: boolean;
                    export { additionalProperties_34 as additionalProperties };
                }
                export { items_15 as items };
                export let minItems: number;
                let maxItems_1: number;
                export { maxItems_1 as maxItems };
            }
            export { Rules_1 as Rules };
        }
        export { properties_25 as properties };
        let required_24: string[];
        export { required_24 as required };
        let additionalProperties_35: boolean;
        export { additionalProperties_35 as additionalProperties };
    }
    namespace tags {
        let type_98: string;
        export { type_98 as type };
        export namespace items_16 {
            let type_99: string;
            export { type_99 as type };
            export namespace properties_37 {
                namespace Key {
                    let type_100: string;
                    export { type_100 as type };
                }
                namespace Value {
                    let type_101: string;
                    export { type_101 as type };
                }
            }
            export { properties_37 as properties };
            let required_25: string[];
            export { required_25 as required };
            let additionalProperties_36: boolean;
            export { additionalProperties_36 as additionalProperties };
        }
        export { items_16 as items };
    }
    namespace versioningConfiguration {
        let type_102: string;
        export { type_102 as type };
        export namespace properties_38 {
            export namespace Status_6 {
                let _enum_14: string[];
                export { _enum_14 as enum };
            }
            export { Status_6 as Status };
        }
        export { properties_38 as properties };
        let required_26: string[];
        export { required_26 as required };
        let additionalProperties_37: boolean;
        export { additionalProperties_37 as additionalProperties };
    }
    namespace websiteConfiguration {
        let type_103: string;
        export { type_103 as type };
        export namespace properties_39 {
            namespace ErrorDocument {
                let type_104: string;
                export { type_104 as type };
            }
            namespace IndexDocument {
                let type_105: string;
                export { type_105 as type };
            }
            namespace RedirectAllRequestsTo {
                let type_106: string;
                export { type_106 as type };
                export namespace properties_40 {
                    namespace HostName {
                        let type_107: string;
                        export { type_107 as type };
                    }
                    namespace Protocol {
                        let _enum_15: string[];
                        export { _enum_15 as enum };
                    }
                }
                export { properties_40 as properties };
                let required_27: string[];
                export { required_27 as required };
                let additionalProperties_38: boolean;
                export { additionalProperties_38 as additionalProperties };
            }
            namespace RoutingRules {
                let type_108: string;
                export { type_108 as type };
                export namespace items_17 {
                    let type_109: string;
                    export { type_109 as type };
                    export namespace properties_41 {
                        namespace RedirectRule {
                            let type_110: string;
                            export { type_110 as type };
                            export namespace properties_42 {
                                export namespace HostName_1 {
                                    let type_111: string;
                                    export { type_111 as type };
                                }
                                export { HostName_1 as HostName };
                                export namespace HttpRedirectCode {
                                    let type_112: string;
                                    export { type_112 as type };
                                }
                                export namespace Protocol_1 {
                                    let _enum_16: string[];
                                    export { _enum_16 as enum };
                                }
                                export { Protocol_1 as Protocol };
                                export namespace ReplaceKeyPrefixWith {
                                    let type_113: string;
                                    export { type_113 as type };
                                }
                                export namespace ReplaceKeyWith {
                                    let type_114: string;
                                    export { type_114 as type };
                                }
                            }
                            export { properties_42 as properties };
                            let additionalProperties_39: boolean;
                            export { additionalProperties_39 as additionalProperties };
                        }
                        namespace RoutingRuleCondition {
                            let type_115: string;
                            export { type_115 as type };
                            export namespace properties_43 {
                                namespace HttpErrorCodeReturnedEquals {
                                    let type_116: string;
                                    export { type_116 as type };
                                }
                                namespace KeyPrefixEquals {
                                    let type_117: string;
                                    export { type_117 as type };
                                }
                            }
                            export { properties_43 as properties };
                            let additionalProperties_40: boolean;
                            export { additionalProperties_40 as additionalProperties };
                        }
                    }
                    export { properties_41 as properties };
                    let required_28: string[];
                    export { required_28 as required };
                    let additionalProperties_41: boolean;
                    export { additionalProperties_41 as additionalProperties };
                }
                export { items_17 as items };
            }
        }
        export { properties_39 as properties };
        let additionalProperties_42: boolean;
        export { additionalProperties_42 as additionalProperties };
    }
}
declare let additionalProperties_43: boolean;
export { additionalProperties_43 as additionalProperties };
