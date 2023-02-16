#!/bin/bash


mongos_server="34.88.236.69:27017"
config_server_1="34.88.236.69:40001"
config_server_2="34.88.236.69:40002"
config_server_3="34.88.236.69:40003"
shard1_server_1="34.88.236.69:50001"
shard1_server_2="34.88.236.69:50002"
shard1_server_3="34.88.236.69:50003"
shard2_server_1="34.88.236.69:50004"
shard2_server_2="34.88.236.69:50005"
shard2_server_3="34.88.236.69:50006"

# Initialize config server replica set
mongosh mongodb://$config_server_1 <<EOF
rs.initiate(
  {
    _id: "cfgrs",
	configsvr: true,
    members: [
      { _id : 0, host : "$config_server_1", priority: 2 },
      { _id : 1, host : "$config_server_2", priority: 1 },
      { _id : 2, host : "$config_server_3", priority: 1 }
    ]
  }
)
EOF

# Initialize shard1 replica set
mongosh mongodb://$shard1_server_1 <<EOF
rs.initiate(
  {
    _id: "shard1rs",
    members: [
      { _id : 0, host : "$shard1_server_1", priority: 2 },
      { _id : 1, host : "$shard1_server_2", priority: 1 },
      { _id : 2, host : "$shard1_server_3" , priority: 1}
    ]
  }
)
EOF

# Initialize shard2 replica set
mongosh mongodb://$shard2_server_1 <<EOF
rs.initiate(
  {
    _id: "shard2rs",
    members: [
      { _id : 0, host : "$shard2_server_1", priority: 2 },
      { _id : 1, host : "$shard2_server_2", priority: 1 },
      { _id : 2, host : "$shard2_server_3" , priority: 1}
    ]
  }
)
EOF

# Add shards to the cluster
mongosh mongodb://34.88.236.69:27017 <<EOF
sh.addShard("shard1rs/$shard1_server_1,$shard1_server_2,$shard1_server_3")
sh.addShard("shard2rs/$shard2_server_1,$shard2_server_2,$shard2_server_3")
EOF

