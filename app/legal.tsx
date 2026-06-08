import BackButton from "@/components/BackButton";
import Header from "@/components/Header";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { verticalScale } from "@/utils/styling";
import { useLocalSearchParams } from "expo-router";
import * as Icons from "phosphor-react-native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

type LegalDocKey = "privacy" | "terms" | "changelog";

type LegalSection = {
  heading: string;
  items?: string[];
  groups?: {
    heading: string;
    items: string[];
  }[];
};

const legalDocs: Record<
  LegalDocKey,
  {
    title: string;
    effectiveDate?: string;
    intro: string;
    sections: LegalSection[];
  }
> = {
  privacy: {
    title: "Privacy Policy",
    effectiveDate: "June 6, 2026",
    intro:
      "Fastra is a personal finance tracking app. This policy explains how Fastra handles your information when you use the app.",
    sections: [
      {
        heading: "Information We Collect",
        items: [
          "Account information such as email address, username, display name, and profile image.",
          "Financial records such as transactions, wallets, categories, debts, receivables, notes, dates, and uploaded transaction images.",
          "App settings such as notification import preferences, source rules, blocked senders, and review states.",
          "Notification content when you enable notification import on Android.",
        ],
      },
      {
        heading: "How We Use Information",
        items: [
          "Provide personal finance tracking features.",
          "Sync your data across signed-in sessions.",
          "Display statistics, summaries, wallets, debts, and transaction history.",
          "Parse supported bank and e-wallet notifications into transaction drafts or records.",
          "Store images you upload for profile or transaction use.",
        ],
      },
      {
        heading: "Storage and Services",
        items: [
          "Fastra uses Firebase Authentication for sign-in and account access.",
          "Fastra uses Firebase Firestore for storing app data.",
          "Fastra uses Cloudinary for storing uploaded images.",
          "Expo and related services may be used for app runtime, notifications, and platform features.",
        ],
      },
      {
        heading: "Notification Access",
        items: [
          "Notification import is optional and requires Android notification listener access.",
          "Fastra uses notification content only to identify and parse supported financial notifications.",
          "You can disable notification access at any time from Android settings or the app's notification import settings.",
        ],
      },
      {
        heading: "Data Sharing",
        items: [
          "Fastra does not sell your personal data.",
          "Your data may be processed by third-party services as needed to provide app features.",
          "Fastra may disclose information if required by law or to protect app security and integrity.",
        ],
      },
      {
        heading: "Contact",
        items: [
          "Website: https://fastra.my.id",
          "Instagram: @frelardi_",
          "Email: farelasrpl@gmail.com",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Use",
    effectiveDate: "June 6, 2026",
    intro:
      "These terms govern your use of Fastra. By using Fastra, you agree to these terms.",
    sections: [
      {
        heading: "Purpose of the App",
        items: [
          "Fastra helps you record transactions, manage wallets, organize categories, track debts and receivables, review statistics, and optionally import supported notifications.",
          "Fastra is not a bank, financial institution, accounting service, or licensed financial advisor.",
        ],
      },
      {
        heading: "Your Responsibility",
        items: [
          "Keep your account credentials secure.",
          "Review the accuracy of transactions, imported notifications, wallet balances, categories, debts, and statistics.",
          "Make sure your use of notification import complies with your local laws, platform rules, and personal privacy expectations.",
        ],
      },
      {
        heading: "Acceptable Use",
        items: [
          "Do not use Fastra for illegal, abusive, fraudulent, or harmful activity.",
          "Do not attempt to access another user's account or data.",
          "Do not interfere with the app, backend services, or third-party services used by Fastra.",
          "Do not upload unlawful, harmful, or infringing images or content.",
        ],
      },
      {
        heading: "Notification Import",
        items: [
          "Notification import is optional and requires Android notification listener access.",
          "Fastra may read supported financial notifications to help create transaction records.",
          "You are responsible for reviewing imported items and correcting any mistakes.",
        ],
      },
      {
        heading: "No Financial Advice",
        items: [
          "Fastra provides tracking, organization, and summary tools only.",
          "Charts, statistics, balances, or insights shown in the app are informational and may not reflect your complete financial position.",
        ],
      },
      {
        heading: "Contact",
        items: [
          "Website: https://fastra.my.id",
          "Instagram: @frelardi_",
          "Email: farelasrpl@gmail.com",
        ],
      },
    ],
  },
  changelog: {
    title: "Changelog",
    intro: "Notable changes to Fastra are listed below.",
    sections: [
      {
        heading: "2.0.4 - June 8, 2026",
        groups: [
          {
            heading: "Added",
            items: [
              "Added About Fastra page with app information, website link, legal pages, changelog access, and contact details.",
              "Added README, contributing guide, and MIT license files for the GitHub repository.",
            ],
          },
          {
            heading: "Improved",
            items: [
              "Improved legal and privacy contact information with website, Instagram, and email details.",
              "Improved GitHub repository presentation with Fastra logo and app preview images.",
            ],
          },
          {
            heading: "Fixed",
            items: ["Fixed ScreenWrapper layout behavior."],
          },
        ],
      },
      {
        heading: "2.0.3 - June 6, 2026",
        groups: [
          {
            heading: "Fixed",
            items: ["Fixed notification import data not rendering."],
          },
        ],
      },
      {
        heading: "2.0.2 - June 4, 2026",
        groups: [
          {
            heading: "Added",
            items: [
              "Added notification inbox review flow for pending imported transactions.",
              "Added deck swiper interaction for reviewing pending imports.",
            ],
          },
          {
            heading: "Improved",
            items: [
              "Improved notification import flow and related UI details.",
            ],
          },
        ],
      },
      {
        heading: "2.0.1 - June 1, 2026",
        groups: [
          {
            heading: "Added",
            items: ["Added username support for authentication."],
          },
          {
            heading: "Improved",
            items: ["Rebranded the app from Entrack to Fastra."],
          },
        ],
      },
      {
        heading: "2.0.0 - May 29, 2026",
        groups: [
          {
            heading: "Added",
            items: [
              "Added Android notification listener for automatic transaction tracking.",
              "Added Android notification import for supported bank and e-wallet notifications.",
            ],
          },
          {
            heading: "Improved",
            items: [
              "Prepared automatic tracking flow using Android notification access.",
            ],
          },
        ],
      },
      {
        heading: "1.2.0 - March 11, 2026",
        groups: [
          {
            heading: "Improved",
            items: ["Polished transaction UI."],
          },
          {
            heading: "Fixed",
            items: ["Fixed Firestore permission handling."],
          },
        ],
      },
      {
        heading: "1.1.9 - March 5, 2026",
        groups: [
          {
            heading: "Added",
            items: [
              "Added more features to the statistics tab.",
              "Added monthly category summaries on the home tab.",
            ],
          },
        ],
      },
      {
        heading: "1.1.8 - March 1, 2026",
        groups: [
          {
            heading: "Added",
            items: [
              "Added pull-to-refresh.",
              "Added forgot password flow.",
              "Added category persistence in Firebase.",
            ],
          },
        ],
      },
      {
        heading: "1.1.7 - February 28, 2026",
        groups: [
          {
            heading: "Fixed",
            items: ["Fixed authentication behavior on poor networks."],
          },
        ],
      },
      {
        heading: "1.1.6 - February 17, 2026",
        groups: [
          {
            heading: "Fixed",
            items: ["Fixed push notification race condition."],
          },
        ],
      },
      {
        heading: "1.1.5 - February 17, 2026",
        groups: [
          {
            heading: "Added",
            items: ["Added daily reminder push notifications."],
          },
        ],
      },
      {
        heading: "1.1.4 - February 17, 2026",
        groups: [
          {
            heading: "Added",
            items: [
              "Added Expo push notifications.",
              "Added auth verification flow.",
            ],
          },
        ],
      },
      {
        heading: "1.1.3 - February 17, 2026",
        groups: [
          {
            heading: "Improved",
            items: [
              "Polished services and UI.",
              "Prepared service structure for push notifications.",
            ],
          },
        ],
      },
      {
        heading: "1.1.2 - February 16, 2026",
        groups: [
          {
            heading: "Fixed",
            items: ["Fixed app icon and app configuration."],
          },
        ],
      },
      {
        heading: "1.1.1 - February 16, 2026",
        groups: [
          {
            heading: "Added",
            items: ["Added income and expense categories."],
          },
        ],
      },
      {
        heading: "1.1.0 - February 16, 2026",
        groups: [
          {
            heading: "Added",
            items: [
              "Added wallet balance editing.",
              "Added transfer support.",
              "Added debt icon.",
            ],
          },
        ],
      },
      {
        heading: "1.0.9 - February 16, 2026",
        groups: [
          {
            heading: "Added",
            items: [
              "Added functional debt tracking.",
              "Added category create, update, and delete flows.",
            ],
          },
          {
            heading: "Improved",
            items: ["Polished debt and category UI/UX."],
          },
        ],
      },
      {
        heading: "1.0.8 - February 15, 2026",
        groups: [
          {
            heading: "Added",
            items: ["Added initial debt feature groundwork."],
          },
        ],
      },
      {
        heading: "1.0.7 - February 15, 2026",
        groups: [
          {
            heading: "Added",
            items: [
              "Added calculator support in transaction modal.",
              "Added transfer support in transaction flows.",
            ],
          },
          {
            heading: "Improved",
            items: ["Polished transaction modal."],
          },
          {
            heading: "Fixed",
            items: ["Fixed transaction modal and finance flow bugs."],
          },
        ],
      },
      {
        heading: "1.0.6 - February 15, 2026",
        groups: [
          {
            heading: "Improved",
            items: ["Redesigned transaction modal UI/UX."],
          },
        ],
      },
      {
        heading: "1.0.5 - February 15, 2026",
        groups: [
          {
            heading: "Added",
            items: ["Added transaction search."],
          },
        ],
      },
      {
        heading: "1.0.4 - February 15, 2026",
        groups: [
          {
            heading: "Added",
            items: [
              "Added functional statistics tab.",
              "Added statistics UI/UX.",
            ],
          },
        ],
      },
      {
        heading: "1.0.3 - February 13, 2026",
        groups: [
          {
            heading: "Added",
            items: [
              "Added transaction management.",
              "Added transaction UI/UX.",
            ],
          },
        ],
      },
      {
        heading: "1.0.2 - February 11, 2026",
        groups: [
          {
            heading: "Added",
            items: ["Added wallet management.", "Added wallet UI/UX."],
          },
        ],
      },
      {
        heading: "1.0.1 - February 9, 2026",
        groups: [
          {
            heading: "Added",
            items: [
              "Added profile tab and profile modal.",
              "Added Cloudinary image storage for profile images.",
            ],
          },
        ],
      },
      {
        heading: "1.0.0 - February 8, 2026",
        groups: [
          {
            heading: "Added",
            items: [
              "Created initial Expo app.",
              "Added splash screen.",
              "Added welcome page.",
              "Added login and register flows with Firebase.",
              "Added home page with tab bar.",
            ],
          },
        ],
      },
    ],
  },
};

const isLegalDocKey = (value: unknown): value is LegalDocKey =>
  value === "privacy" || value === "terms" || value === "changelog";

const getChangelogGroupMeta = (heading: string) => {
  switch (heading) {
    case "Added":
      return {
        Icon: Icons.PlusCircleIcon,
        color: "#22C55E",
      };
    case "Fixed":
      return {
        Icon: Icons.CheckCircleIcon,
        color: "#0EA5E9",
      };
    case "Improved":
      return {
        Icon: Icons.WrenchIcon,
        color: "#F59E0B",
      };
    default:
      return {
        Icon: Icons.DotOutlineIcon,
        color: colors.neutral300,
      };
  }
};

const getContactIcon = (item: string) => {
  if (item.startsWith("Website:")) return Icons.GlobeHemisphereEastIcon;
  if (item.startsWith("Instagram:")) return Icons.InstagramLogoIcon;
  if (item.startsWith("Email:")) return Icons.EnvelopeSimpleIcon;
  return null;
};

const renderHighlightedText = (text: string, docKey: LegalDocKey) => {
  if (docKey === "changelog") return text;

  const parts = text.split("Fastra");
  if (parts.length === 1) return text;

  return parts.map((part, index) => (
    <React.Fragment key={`${part}-${index}`}>
      {part}
      {index < parts.length - 1 && (
        <Text style={styles.brandHighlight}>Fastra</Text>
      )}
    </React.Fragment>
  ));
};

const Legal = () => {
  const params = useLocalSearchParams<{ doc?: string }>();
  const docKey = isLegalDocKey(params.doc) ? params.doc : "privacy";
  const doc = legalDocs[docKey];

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header
          title={doc.title}
          leftIcon={<BackButton />}
          style={{ marginVertical: spacingY._10 }}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {doc.effectiveDate && (
            <View style={styles.datePill}>
              <Typo size={12} color={colors.black} fontWeight={"900"}>
                Effective {doc.effectiveDate}
              </Typo>
            </View>
          )}

          <Typo size={14} color={colors.neutral300} style={styles.intro}>
            {renderHighlightedText(doc.intro, docKey)}
          </Typo>

          <View style={styles.sections}>
            {doc.sections.map((section) => (
              <View key={section.heading} style={styles.section}>
                <Typo size={18} fontWeight={"800"}>
                  {section.heading}
                </Typo>

                {section.items && (
                  <View style={styles.bulletList}>
                    {section.items.map((item) => (
                      <View key={item} style={styles.bulletRow}>
                        {(() => {
                          const ContactIcon =
                            section.heading === "Contact"
                              ? getContactIcon(item)
                              : null;

                          return ContactIcon ? (
                            <ContactIcon
                              size={verticalScale(16)}
                              color={colors.primary}
                              weight="bold"
                            />
                          ) : (
                            <View style={styles.bullet} />
                          );
                        })()}
                        <Typo
                          size={13}
                          color={colors.neutral300}
                          style={styles.bulletText}
                        >
                          {renderHighlightedText(item, docKey)}
                        </Typo>
                      </View>
                    ))}
                  </View>
                )}

                {section.groups?.map((group) => (
                  <View key={group.heading} style={styles.group}>
                    {(() => {
                      const { Icon, color } = getChangelogGroupMeta(
                        group.heading,
                      );
                      return (
                        <View style={styles.groupTitleRow}>
                          <Icon
                            size={verticalScale(16)}
                            color={color}
                            weight="fill"
                          />
                          <Typo
                            size={14}
                            fontWeight={"800"}
                            color={colors.neutral200}
                          >
                            {group.heading}
                          </Typo>
                        </View>
                      );
                    })()}

                    <View style={styles.bulletList}>
                      {group.items.map((item) => (
                        <View key={item} style={styles.bulletRow}>
                          <View style={styles.bullet} />
                          <Typo
                            size={13}
                            color={colors.neutral300}
                            style={styles.bulletText}
                          >
                            {item}
                          </Typo>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
};

export default Legal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  content: {
    paddingTop: spacingY._10,
    paddingBottom: spacingY._40,
  },
  datePill: {
    alignSelf: "flex-start",
    borderRadius: radius._30,
    backgroundColor: colors.primary,
    paddingHorizontal: spacingX._12,
    paddingVertical: spacingY._5,
  },
  intro: {
    marginTop: spacingY._15,
    lineHeight: 22,
  },
  sections: {
    marginTop: spacingY._25,
    gap: spacingY._20,
  },
  section: {
    gap: spacingY._10,
  },
  group: {
    gap: spacingY._10,
  },
  groupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
  },
  bulletList: {
    gap: spacingY._10,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacingX._10,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginTop: spacingY._7,
  },
  bulletText: {
    flex: 1,
    lineHeight: 20,
  },
  brandHighlight: {
    color: colors.white,
    textDecorationLine: "underline",
    textDecorationColor: colors.primary,
    textDecorationStyle: "solid",
    textShadowColor: colors.primary,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
});
