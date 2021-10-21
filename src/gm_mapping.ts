import { Transfer as TransferEvent } from '../generated/GenesisMana/GenesisMana';
import { Mana, Order, Bag, Transfer, Wallet } from '../generated/schema';
import { GenesisMana } from '../generated/GenesisMana/GenesisMana';
import { BigInt } from '@graphprotocol/graph-ts';

export function handleTransfer(event: TransferEvent): void {
  let fromAddress = event.params.from;
  let toAddress = event.params.to;
  let tokenId = event.params.tokenId;
  let fromId = fromAddress.toHex();
  let fromWallet = Wallet.load(fromId);
  let lootTokenId = "";
  let orderId = "";

  if (!fromWallet) {
    fromWallet = new Wallet(fromId);
    fromWallet.address = fromAddress;
    fromWallet.joined = event.block.timestamp;
    fromWallet.manasHeld = BigInt.fromI32(0);
    fromWallet.save();
  } else {
    if (!isZeroAddress(fromId)) {
      fromWallet.manasHeld = fromWallet.manasHeld.minus(BigInt.fromI32(1));
      fromWallet.save();
    }
  }

  let toId = toAddress.toHex();
  let toWallet = Wallet.load(toId);
  if (!toWallet) {
    toWallet = new Wallet(toId);
    toWallet.address = toAddress;
    toWallet.joined = event.block.timestamp;
    toWallet.manasHeld = BigInt.fromI32(1);
    toWallet.save();
  } else {
    toWallet.manasHeld = toWallet.manasHeld.plus(BigInt.fromI32(1));
    toWallet.save();
  }

  let mana = Mana.load(tokenId.toString());
  if (mana != null) {
    mana.currentOwner = toWallet.id;
    mana.save();
  } else {
    mana = new Mana(tokenId.toString());
    let contract = GenesisMana.bind(event.address);
    let manaDetails = contract.detailsByToken(tokenId);
    lootTokenId =  manaDetails.value0.toString();
    orderId = manaDetails.value2.toString();

    mana.lootTokenId = lootTokenId;
    mana.itemName = manaDetails.value1;
    mana.suffixId = orderId;
    mana.inventoryId = manaDetails.value3;
    mana.currentOwner = toWallet.id;
    mana.minted = event.block.timestamp;
    mana.tokenURI = contract.tokenURI(tokenId);
    if (!isZeroAddress(fromId)) {
      mana.OGMinterAddress = toAddress;
    }
    mana.save();

    let order = Order.load(mana.suffixId);
    if (!order) {
      order = new Order(mana.suffixId);
      order.manasHeld = BigInt.fromI32(1);
      order.save();
    } else {
      order.manasHeld = order.manasHeld.plus(BigInt.fromI32(1));
      order.save();
    }
  }

  if (lootTokenId != "0") {
    let bag = Bag.load(lootTokenId);
    if (bag != null) {
      if (bag.manasClaimed)
        bag.manasClaimed = bag.manasClaimed.plus(BigInt.fromI32(1));
      bag.manasUnclaimed = bag.manasUnclaimed.minus(BigInt.fromI32(1));
      bag.save();
    }
  }

  let transfer = new Transfer(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );

  transfer.mana = tokenId.toString();
  transfer.from = fromWallet.id;
  transfer.to = toWallet.id;
  transfer.txHash = event.transaction.hash;
  transfer.timestamp = event.block.timestamp;
  transfer.save();

}

function isZeroAddress(string: string): boolean {
  return string == '0x0000000000000000000000000000000000000000';
}
