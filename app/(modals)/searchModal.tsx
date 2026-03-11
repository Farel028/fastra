import BackButton from "@/components/BackButton";
import Header from "@/components/Header";
import Input from "@/components/Input";
import ModalWrapper from "@/components/ModalWrapper";
import TransactionList from "@/components/TransactionList";
import { colors, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import useFetchData from "@/hooks/useFetchData";
import { TransactionType } from "@/types";
import { useRouter } from "expo-router";
import { orderBy, where } from "firebase/firestore";
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

const SearchModal = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const constraints = useMemo(
    () =>
      user?.uid
        ? [where("uid", "==", user.uid), orderBy("date", "desc")]
        : [],
    [user?.uid],
  );

  const { data: allTransactions, loading: transactionLoading } =
    useFetchData<TransactionType>(user?.uid ? "transactions" : "", constraints);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredTransactions = useMemo(
    () =>
      allTransactions.filter((item) => {
        if (normalizedSearch.length <= 1) return true;
        return (
          item.category?.toLowerCase()?.includes(normalizedSearch) ||
          item.type?.toLowerCase()?.includes(normalizedSearch) ||
          item.description?.toLowerCase()?.includes(normalizedSearch)
        );
      }),
    [allTransactions, normalizedSearch],
  );

  return (
    <ModalWrapper onClose={() => router.back()} swipeEnabled={false}>
      <View style={styles.container}>
        <Header
          title={"Search"}
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._10 }}
        />

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Input
              placeholder="shoes.."
              value={search}
              placeholderTextColor={colors.neutral400}
              containerStyle={{ backgroundColor: colors.neutral800 }}
              onChangeText={(value) => setSearch(value)}
            />
          </View>
          <View style={styles.listWrap}>
            <TransactionList
              loading={transactionLoading}
              data={filteredTransactions}
              emptyListMessage="No transactions match"
              fitParent
              disableItemAnimation
            />
          </View>
        </View>
      </View>
    </ModalWrapper>
  );
};

export default SearchModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacingY._20,
  },

  form: {
    flex: 1,
    gap: spacingY._30,
    marginTop: spacingY._15,
  },
  inputContainer: {
    gap: spacingY._10,
  },
  listWrap: {
    flex: 1,
  },
});
